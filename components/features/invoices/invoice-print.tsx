"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { generateInvoicePDF } from "@/lib/utils/invoice-pdf";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { getServedByName } from "@/lib/utils/get-served-by";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface InvoicePrintProps {
	invoiceId: string;
	invoiceNumber: string;
	invoiceData?: any; // Optional: pass invoice data if already loaded
}

export function InvoicePrint({
	invoiceId,
	invoiceNumber,
	invoiceData,
}: InvoicePrintProps) {
	const { toast } = useToast();
	const [isGenerating, setIsGenerating] = useState(false);
	const [format, setFormat] = useState<"invoice" | "slip">("invoice");

	const handlePrint = async (selectedFormat?: "invoice" | "slip") => {
		const currentFormat = selectedFormat || format;
		setIsGenerating(true);
		try {
			let invoice: any = null;
			let items: any[] = [];
			let customer: any = null;
			let profile: any = null;

			// If invoice data is already provided, use it (avoid API call)
			if (invoiceData) {
				invoice = invoiceData;
				items = invoice.invoice_items || invoice.items || [];
				customer = invoice.customers || invoice.customer || null;
				profile = invoice.profile || null;

				// Transform items to match PDF generator format (snake_case to camelCase)
				items = items.map((item: any) => ({
					description: item.description || "",
					quantity: Number(item.quantity) || 0,
					unitPrice: Number(item.unit_price || item.unitPrice) || 0,
					discountPercent:
						Number(item.discount_percent || item.discountPercent) || 0,
					gstRate: Number(item.gst_rate || item.gstRate) || 0,
					lineTotal: Number(item.line_total || item.lineTotal) || 0,
					gstAmount: Number(item.gst_amount || item.gstAmount) || 0,
				}));
			} else {
				// Fallback: Fetch from database directly if data not provided
				console.log("[InvoicePrint] Fetching invoice from database (fallback)");

				const { isIndexedDbMode } = await import("@/lib/utils/db-mode");
				const { createClient } = await import("@/lib/supabase/client");
				const { db } = await import("@/lib/dexie-client");
				const isIndexedDb = isIndexedDbMode();

				if (isIndexedDb) {
					// Fetch from IndexedDB
					invoice = await db.invoices.get(invoiceId);
					if (!invoice) throw new Error("Invoice not found");

					const rawItems = await db.invoice_items
						.where("invoice_id")
						.equals(invoiceId)
						.toArray();

					customer = invoice.customer_id
						? await db.customers.get(invoice.customer_id)
						: null;

					// Get profile from Supabase (business settings)
					const supabase = createClient();
					const {
						data: { user },
					} = await supabase.auth.getUser();
					if (user) {
						const { data: prof } = await supabase
							.from("user_profiles")
							.select("*")
							.eq("id", user.id)
							.single();
						profile = prof;
					}

					items = rawItems.map((item: any) => ({
						description: item.description || "",
						quantity: Number(item.quantity) || 0,
						unitPrice: Number(item.unit_price) || 0,
						discountPercent: Number(item.discount_percent) || 0,
						gstRate: Number(item.gst_rate) || 0,
						lineTotal: Number(item.line_total) || 0,
						gstAmount: Number(item.gst_amount) || 0,
					}));
				} else {
					// Fetch from Supabase
					const supabase = createClient();

					const { data: invData, error: invoiceError } = await supabase
						.from("invoices")
						.select("*, customers(*)")
						.eq("id", invoiceId)
						.single();

					if (invoiceError || !invData) {
						throw new Error(invoiceError?.message || "Invoice not found");
					}

					invoice = invData;
					customer = invData.customers || null;

					const { data: itemsData, error: itemsError } = await supabase
						.from("invoice_items")
						.select("*")
						.eq("invoice_id", invoiceId);

					if (itemsError) {
						console.warn("[InvoicePrint] Error fetching items:", itemsError);
					}

					const rawItems = itemsData || [];

					// Get profile
					const {
						data: { user },
					} = await supabase.auth.getUser();
					if (user) {
						const { data: prof } = await supabase
							.from("user_profiles")
							.select("*")
							.eq("id", user.id)
							.single();
						profile = prof;
					}

					items = rawItems.map((item: any) => ({
						description: item.description || "",
						quantity: Number(item.quantity) || 0,
						unitPrice: Number(item.unit_price) || 0,
						discountPercent: Number(item.discount_percent) || 0,
						gstRate: Number(item.gst_rate) || 0,
						lineTotal: Number(item.line_total) || 0,
						gstAmount: Number(item.gst_amount) || 0,
					}));
				}
			}

			// Validate required data
			if (!items || items.length === 0) {
				throw new Error("No items found for invoice");
			}

			// Get served by name
			const servedBy = await getServedByName(invoice);

			// Generate PDF based on format
			let pdfBlob: Blob;

			if (currentFormat === "invoice") {
				console.log("[InvoicePrint] Generating invoice PDF...");
				pdfBlob = await generateInvoicePDF({
					invoiceNumber: invoice.invoice_number || invoiceNumber,
					invoiceDate:
						invoice.invoice_date ||
						invoice.invoiceDate ||
						new Date().toISOString(),
					dueDate: invoice.due_date || invoice.dueDate,
					customerName: customer?.name,
					customerEmail: customer?.email,
					customerPhone: customer?.phone,
					customerGSTIN: customer?.gstin,
					businessName: profile?.business_name || "Business",
					businessGSTIN: profile?.business_gstin,
					businessAddress: profile?.business_address,
					businessPhone: profile?.business_phone,
					businessEmail: profile?.business_email,
					logoUrl: profile?.logo_url,
					servedBy: servedBy,
					items: items || [],
					subtotal: Number(invoice.subtotal) || 0,
					cgstAmount: Number(invoice.cgst_amount || invoice.cgstAmount) || 0,
					sgstAmount: Number(invoice.sgst_amount || invoice.sgstAmount) || 0,
					igstAmount: Number(invoice.igst_amount || invoice.igstAmount) || 0,
					totalAmount: Number(invoice.total_amount || invoice.totalAmount) || 0,
					notes: invoice.notes,
					terms: invoice.terms,
					isGstInvoice: invoice.is_gst_invoice || invoice.isGstInvoice || false,
				});
			} else {
				// Slip format
				console.log("[InvoicePrint] Generating slip PDF...");
				const { generateInvoiceSlipPDF } = await import(
					"@/lib/utils/invoice-slip-pdf"
				);
				pdfBlob = await generateInvoiceSlipPDF({
					invoiceNumber: invoice.invoice_number || invoiceNumber,
					invoiceDate:
						invoice.invoice_date ||
						invoice.invoiceDate ||
						new Date().toISOString(),
					customerName: customer?.name,
					customerEmail: customer?.email,
					customerPhone: customer?.phone,
					customerGSTIN: customer?.gstin,
					businessName: profile?.business_name || "Business",
					businessGSTIN: profile?.business_gstin,
					businessAddress: profile?.business_address,
					businessPhone: profile?.business_phone,
					businessEmail: profile?.business_email,
					logoUrl: profile?.logo_url,
					servedBy: servedBy,
					items: items || [],
					subtotal: Number(invoice.subtotal) || 0,
					cgstAmount: Number(invoice.cgst_amount || invoice.cgstAmount) || 0,
					sgstAmount: Number(invoice.sgst_amount || invoice.sgstAmount) || 0,
					igstAmount: Number(invoice.igst_amount || invoice.igstAmount) || 0,
					totalAmount: Number(invoice.total_amount || invoice.totalAmount) || 0,
					isGstInvoice: invoice.is_gst_invoice || invoice.isGstInvoice || false,
				});
			}

			if (!pdfBlob || !(pdfBlob instanceof Blob)) {
				throw new Error("PDF generation returned invalid blob");
			}

			console.log(
				"[InvoicePrint] PDF generated successfully, size:",
				pdfBlob.size
			);

			// Open PDF in new window for printing (reverted from iframe approach)
			const url = URL.createObjectURL(pdfBlob);
			const printWindow = window.open(url, "_blank");

			if (!printWindow) {
				// Popup blocked - fallback to download
				toast({
					title: "Popup Blocked",
					description:
						"Please allow popups and try again, or download the PDF instead.",
					variant: "destructive",
				});
				// Download as fallback
				const downloadLink = document.createElement("a");
				downloadLink.href = url;
				downloadLink.download =
					currentFormat === "invoice"
						? `Invoice-${invoice.invoice_number || invoiceNumber}.pdf`
						: `Invoice-Slip-${invoice.invoice_number || invoiceNumber}.pdf`;
				document.body.appendChild(downloadLink);
				downloadLink.click();
				document.body.removeChild(downloadLink);
				URL.revokeObjectURL(url);
				return;
			}

			// Wait for window to load, then trigger print
			printWindow.onload = () => {
				setTimeout(() => {
					printWindow.print();
					// Clean up URL after a delay
					setTimeout(() => {
						URL.revokeObjectURL(url);
					}, 1000);
				}, 500);
			};

			toast({
				title: "Success",
				description: `Invoice PDF (${currentFormat.toUpperCase()}) generated. Opening in new window...`,
			});
		} catch (error: any) {
			// Better error logging
			const errorMessage = error?.message || String(error) || "Unknown error";
			const errorDetails = {
				message: errorMessage,
				name: error?.name,
				stack: error?.stack,
				toString: String(error),
				type: typeof error,
			};

			console.error("[InvoicePrint] Print process error:", errorDetails);
			console.error("[InvoicePrint] Full error object:", error);

			toast({
				title: "Error",
				description:
					errorMessage ||
					"Failed to generate invoice PDF. Check console for details.",
				variant: "destructive",
			});
		} finally {
			setIsGenerating(false);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" disabled={isGenerating} className="gap-2">
					<Printer className="h-4 w-4" />
					{isGenerating ? "Generating..." : "Print Invoice"}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem
					onClick={() => {
						handlePrint("invoice");
					}}
				>
					Print Invoice
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => {
						handlePrint("slip");
					}}
				>
					Print Slip
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
