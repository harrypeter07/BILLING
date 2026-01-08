import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveInvoiceStorage } from "@/lib/utils/save-invoice-storage";
import { uploadInvoicePDFToR2 } from "@/lib/utils/r2-storage";
import { generateSlipHTML } from "@/lib/utils/invoice-slip-html-generator";
import type { InvoiceSlipData } from "@/lib/utils/invoice-slip-pdf";
import puppeteer from "puppeteer-core";

/**
 * Background API endpoint for PDF generation and R2 upload
 *
 * This endpoint is called asynchronously (fire-and-forget) after the invoice
 * is saved and WhatsApp is opened. It handles:
 * 1. Fetching invoice data
 * 2. Fetching business profile
 * 3. Getting served-by name
 * 4. Generating PDF
 * 5. Uploading to R2
 * 6. Saving metadata
 *
 * The client does NOT wait for this to complete.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { invoiceId } = body;

		if (!invoiceId) {
			return NextResponse.json(
				{ error: "invoiceId is required" },
				{ status: 400 }
			);
		}

		// Start background processing (don't await - return immediately)
		// This ensures the API responds quickly while processing continues
		processInvoicePDFInBackground(invoiceId).catch((error) => {
			console.error(
				"[GeneratePDFAndUpload] Background processing error:",
				error
			);
		});

		// Return immediately - processing happens in background
		return NextResponse.json({
			success: true,
			message: "PDF generation and upload started in background",
		});
	} catch (error) {
		console.error("[GeneratePDFAndUpload] Error:", error);
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error ? error.message : "Failed to start processing",
			},
			{ status: 500 }
		);
	}
}

/**
 * Background processing function
 * Handles all heavy operations: fetching data, generating PDF, uploading to R2
 */
async function processInvoicePDFInBackground(invoiceId: string) {
	try {
		console.log(
			`[GeneratePDFAndUpload] Starting background processing for invoice: ${invoiceId}`
		);

		const supabase = await createClient();

		// 1. Fetch invoice data first (to get user_id for both admin and employee contexts)
		const { data: invoice, error: invoiceError } = await supabase
			.from("invoices")
			.select("*")
			.eq("id", invoiceId)
			.single();

		if (invoiceError || !invoice) {
			throw new Error(`Invoice not found: ${invoiceError?.message}`);
		}

		// 2. Get user context - use invoice.user_id (which is admin_user_id for employees)
		// For employees, invoice.user_id is their store's admin_user_id
		// For admins, invoice.user_id is their own user_id
		let userId = invoice.user_id;

		// Try to get authenticated user (for admins)
		const {
			data: { user },
		} = await supabase.auth.getUser();

		// If no auth user but invoice has user_id, use that (employee context)
		// If auth user exists, verify it matches invoice.user_id (security check)
		if (user) {
			if (user.id !== invoice.user_id) {
				// Admin accessing invoice - verify they own it via store relationship
				const { data: store } = await supabase
					.from("stores")
					.select("admin_user_id")
					.eq("id", invoice.store_id || "")
					.maybeSingle();

				if (store?.admin_user_id !== user.id && invoice.user_id !== user.id) {
					throw new Error("Unauthorized access to invoice");
				}
			}
			userId = user.id;
		} else if (!invoice.user_id) {
			throw new Error("Invoice missing user_id");
		}

		// 3. Fetch invoice items
		const { data: items, error: itemsError } = await supabase
			.from("invoice_items")
			.select("*")
			.eq("invoice_id", invoiceId);

		if (itemsError || !items) {
			throw new Error(`Invoice items not found: ${itemsError?.message}`);
		}

		// 4. Fetch customer data
		let customer: any = null;
		if (invoice.customer_id) {
			const { data: customerData } = await supabase
				.from("customers")
				.select("*")
				.eq("id", invoice.customer_id)
				.single();
			customer = customerData;
		}

		// 5. Fetch business profile (use userId which is admin_user_id for employees)
		const { data: businessProfile } = await supabase
			.from("user_profiles")
			.select("*")
			.eq("id", userId)
			.single();

		// 6. Get store name (if store_id exists)
		let storeName = "Business";
		if (invoice.store_id) {
			const { data: store } = await supabase
				.from("stores")
				.select("name")
				.eq("id", invoice.store_id)
				.single();
			if (store?.name) {
				storeName = store.name;
			}
		} else if (businessProfile?.business_name) {
			storeName = businessProfile.business_name;
		}

		// 7. Get served-by name (server-side version)
		let servedBy: string | undefined;
		const employeeId = invoice.created_by_employee_id || invoice.employee_id;
		if (employeeId) {
			const { data: employee } = await supabase
				.from("employees")
				.select("name")
				.eq("employee_id", employeeId)
				.single();
			if (employee?.name) {
				servedBy = employee.name;
			}
		}
		if (!servedBy && invoice.user_id) {
			const { data: profile } = await supabase
				.from("user_profiles")
				.select("full_name, business_name")
				.eq("id", invoice.user_id)
				.single();
			if (profile?.full_name) {
				servedBy = profile.full_name;
			} else if (profile?.business_name) {
				servedBy = profile.business_name;
			} else if (user.email) {
				servedBy = user.email.split("@")[0];
			}
		}

		// Check B2B mode (use userId which is admin_user_id for employees)
		let isB2B = false;
		try {
			const { data: b2bSettings } = await supabase
				.from("business_settings")
				.select("is_b2b_enabled")
				.eq("user_id", userId)
				.single();
			isB2B = b2bSettings?.is_b2b_enabled || false;
		} catch (error) {
			console.warn("[GeneratePDFAndUpload] Failed to check B2B mode:", error);
		}

		// 8. Prepare PDF data
		const pdfData = {
			invoiceNumber: invoice.invoice_number,
			invoiceDate: invoice.invoice_date,
			customerName: customer?.name || "",
			customerEmail: customer?.email || "",
			customerPhone: customer?.phone || "",
			customerGSTIN: customer?.gstin || "",
			customerAddress: customer?.address || customer?.billing_address || "",
			customerBillingAddress:
				customer?.billing_address || customer?.address || "",
			customerCity: customer?.city || "",
			customerState: customer?.state || "",
			customerPincode: customer?.pincode || "",
			businessName: businessProfile?.business_name || storeName || "Business",
			businessGSTIN: businessProfile?.business_gstin || "",
			businessAddress: businessProfile?.business_address || "",
			businessPhone: businessProfile?.business_phone || "",
			businessEmail: businessProfile?.business_email || "",
			logoUrl: businessProfile?.logo_url || "",
			servedBy: servedBy,
			items: items.map((item) => {
				// Use same calculation logic as unified engine (calculateLineItem)
				const quantity = Number(item.quantity) || 0;
				const unitPrice = Number(item.unit_price) || 0;
				const discountPercent = Number(item.discount_percent || 0);
				const gstRate = Number(item.gst_rate || 0);

				// Calculate using same formula as unified engine
				const subtotal = quantity * unitPrice;
				const discountAmount = (subtotal * discountPercent) / 100;
				const taxableAmount = subtotal - discountAmount;
				const gstAmount = invoice.is_gst_invoice
					? (taxableAmount * gstRate) / 100
					: Number(item.gst_amount || 0);
				const lineTotal = taxableAmount + gstAmount;

				return {
					description: item.description || "",
					quantity,
					unitPrice,
					discountPercent,
					gstRate,
					lineTotal: Number(item.line_total || lineTotal),
					gstAmount: Number(item.gst_amount || gstAmount),
					hsnCode: item.hsn_code || "",
				};
			}),
			subtotal: Number(invoice.subtotal || invoice.total_amount) || 0,
			cgstAmount: Number(invoice.cgst_amount || 0),
			sgstAmount: Number(invoice.sgst_amount || 0),
			igstAmount: Number(invoice.igst_amount || 0),
			totalAmount: Number(invoice.total_amount) || 0,
			isGstInvoice: invoice.is_gst_invoice || false,
			isB2B,
		};

		// 9. Generate PDF using server-side Puppeteer
		console.log(
			`[GeneratePDFAndUpload] Generating PDF for invoice: ${invoice.invoice_number}`
		);

		// Ensure logoUrl is present
		const pdfDataWithLogo = {
			...pdfData,
			logoUrl:
				pdfData.logoUrl ||
				"https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=80&h=40&fit=crop&auto=format",
		};

		const html = generateSlipHTML(pdfDataWithLogo);

		// Launch Puppeteer
		const isProduction =
			process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
		let browser;
		if (isProduction) {
			const chromium = await import("@sparticuz/chromium");
			browser = await puppeteer.launch({
				args: chromium.args,
				defaultViewport: chromium.defaultViewport,
				executablePath: await chromium.executablePath(),
				headless: chromium.headless,
			});
		} else {
			browser = await puppeteer.launch({
				headless: true,
				args: ["--no-sandbox", "--disable-setuid-sandbox"],
				executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
			});
		}

		let pdfBuffer: Buffer;
		try {
			const page = await browser.newPage();
			await page.setContent(html, { waitUntil: "networkidle0" });

			pdfBuffer = Buffer.from(
				await page.pdf({
					printBackground: true,
					margin: { top: "6mm", right: "6mm", bottom: "6mm", left: "6mm" },
					width: "80mm",
					height: "auto", // Auto height allows longer bills with multiple pages
					pageRanges: "1-", // Allow multiple pages
				})
			);

			await browser.close();
		} catch (error) {
			await browser.close();
			throw error;
		}

		if (!pdfBuffer || pdfBuffer.length === 0) {
			throw new Error("PDF generation returned empty buffer");
		}

		console.log(
			`[GeneratePDFAndUpload] PDF generated, size: ${pdfBuffer.length} bytes`
		);

		// 10. Upload to R2
		console.log(
			`[GeneratePDFAndUpload] Uploading PDF to R2 for invoice: ${invoice.invoice_number}`
		);
		const uploadResult = await uploadInvoicePDFToR2(
			pdfBuffer,
			userId, // Use userId (admin_user_id for employees)
			invoiceId,
			invoice.invoice_number,
			invoice.store_id || undefined
		);

		if (!uploadResult.success || !uploadResult.publicUrl) {
			throw new Error(
				`R2 upload failed: ${uploadResult.error || "Unknown error"}`
			);
		}

		console.log(
			`[GeneratePDFAndUpload] R2 upload successful: ${uploadResult.publicUrl}`
		);

		// 11. Save metadata
		// Calculate expiration date (14 days from now)
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 14);

		await saveInvoiceStorage({
			invoice_id: invoiceId,
			r2_object_key: uploadResult.objectKey || "",
			public_url: uploadResult.publicUrl,
			expires_at: expiresAt.toISOString(),
		});

		console.log(
			`[GeneratePDFAndUpload] Background processing completed successfully for invoice: ${invoiceId}`
		);
	} catch (error) {
		console.error(
			`[GeneratePDFAndUpload] Background processing failed for invoice ${invoiceId}:`,
			error
		);
		// Don't throw - this is background processing, errors are logged but don't affect user
	}
}
