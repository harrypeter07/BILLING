/**
 * Unified Invoice Document Engine
 * 
 * Single source of truth for all invoice document operations:
 * - Data fetching (IndexedDB + Supabase)
 * - Data normalization
 * - PDF generation (Invoice A4 + Slip 80mm)
 * - Actions (Print, Download, WhatsApp, R2 Upload)
 * 
 * Architecture:
 * - UI components call executeInvoiceAction() only
 * - All business logic lives here
 * - No duplicate data preparation
 * - Intelligent generation mode selection
 */

"use client";

import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/dexie-client";
import { isIndexedDbMode } from "@/lib/utils/db-mode";
import { generateInvoicePDF, type InvoicePDFData } from "@/lib/utils/invoice-pdf";
import {
	generateInvoiceSlipPDF,
	type InvoiceSlipData,
} from "@/lib/utils/invoice-slip-pdf";
import { generateWhatsAppBillMessage, shareOnWhatsApp } from "@/lib/utils/whatsapp-bill";
import { getInvoiceStorage } from "@/lib/utils/save-invoice-storage";
import { calculateLineItem } from "@/lib/utils/gst-calculator";

// ============================================================================
// TYPES
// ============================================================================

export type DocumentFormat = "invoice" | "slip";
export type DocumentAction = "print" | "download" | "whatsapp" | "r2-upload";

export interface InvoiceDocumentSource {
	invoice: any;
	items?: any[];
	customer?: any;
	store?: any;
	profile?: any;
	storeName?: string;
}

export interface InvoiceDocumentData {
	invoiceNumber: string;
	invoiceDate: string;
	dueDate?: string;
	customerName: string;
	customerEmail: string;
	customerPhone: string;
	customerGSTIN: string;
	businessName: string;
	businessGSTIN: string;
	businessAddress: string;
	businessPhone: string;
	businessEmail: string;
	logoUrl: string;
	servedBy?: string;
	items: Array<{
		description: string;
		quantity: number;
		unitPrice: number;
		discountPercent: number;
		gstRate: number;
		lineTotal: number;
		gstAmount: number;
	}>;
	subtotal: number;
	cgstAmount: number;
	sgstAmount: number;
	igstAmount: number;
	totalAmount: number;
	notes?: string;
	terms?: string;
	isGstInvoice: boolean;
}

export interface ExecuteInvoiceActionOptions {
	invoiceId: string;
	action: DocumentAction;
	format?: DocumentFormat;
	source?: InvoiceDocumentSource; // Optional: if data already loaded
	onProgress?: (message: string) => void;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetches complete invoice data from IndexedDB or Supabase
 * Handles both modes transparently
 */
async function fetchInvoiceData(
	invoiceId: string,
	source?: InvoiceDocumentSource
): Promise<InvoiceDocumentSource> {
	// If source data provided, use it (avoid redundant fetch)
	if (source?.invoice) {
		return source;
	}

	const isIndexedDb = isIndexedDbMode();

	if (isIndexedDb) {
		// Fetch from IndexedDB
		const invoice = await db.invoices.get(invoiceId);
		if (!invoice) {
			throw new Error(`Invoice ${invoiceId} not found in IndexedDB`);
		}

		const items = await db.invoice_items
			.where("invoice_id")
			.equals(invoiceId)
			.toArray();

		const customer = invoice.customer_id
			? await db.customers.get(invoice.customer_id)
			: null;

		const store = invoice.store_id ? await db.stores.get(invoice.store_id) : null;

		// Fetch profile from Supabase (business settings)
		let profile: any = null;
		try {
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
		} catch (err) {
			console.warn("[InvoiceDocumentEngine] Failed to fetch profile:", err);
		}

		return { invoice, items, customer, store, profile };
	} else {
		// Fetch from Supabase
		const supabase = createClient();

		// Fetch invoice and items in parallel
		const [invoiceResult, itemsResult] = await Promise.all([
			supabase.from("invoices").select("*, customers(*)").eq("id", invoiceId).single(),
			supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId),
		]);

		if (invoiceResult.error || !invoiceResult.data) {
			throw new Error(
				`Invoice ${invoiceId} not found: ${invoiceResult.error?.message}`
			);
		}

		const invoice = invoiceResult.data;
		const items = itemsResult.data || [];
		const customer = invoice.customers || null;

		// Fetch store if available
		let store: any = null;
		if (invoice.store_id) {
			const { data: storeData } = await supabase
				.from("stores")
				.select("*")
				.eq("id", invoice.store_id)
				.maybeSingle();
			store = storeData;
		}

		// Fetch profile in parallel with store
		let profile: any = null;
		try {
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
		} catch (err) {
			console.warn("[InvoiceDocumentEngine] Failed to fetch profile:", err);
		}

		return { invoice, items, customer, store, profile };
	}
}

/**
 * Gets served-by name (employee or admin who created invoice)
 */
async function getServedByName(invoice: any): Promise<string | undefined> {
	try {
		const employeeId = invoice.created_by_employee_id || invoice.employee_id;

		if (employeeId) {
			const isIndexedDb = isIndexedDbMode();

			if (isIndexedDb) {
				const employee = await db.employees
					.where("employee_id")
					.equals(employeeId)
					.first();
				if (employee?.name) {
					return employee.name;
				}
			} else {
				const supabase = createClient();
				const { data: employee } = await supabase
					.from("employees")
					.select("name")
					.eq("employee_id", employeeId)
					.single();
				if (employee?.name) {
					return employee.name;
				}
			}
		}

		// If no employee, check if created by admin
		const userId = invoice.user_id;
		if (userId) {
			const supabase = createClient();
			const { data: profile } = await supabase
				.from("user_profiles")
				.select("full_name, business_name")
				.eq("id", userId)
				.single();

			if (profile?.full_name) {
				return profile.full_name;
			}
			if (profile?.business_name) {
				return profile.business_name;
			}

			const { data: { user } } = await supabase.auth.getUser();
			if (user?.email) {
				return user.email.split("@")[0];
			}
		}

		return undefined;
	} catch (error) {
		console.warn("[InvoiceDocumentEngine] Error fetching served-by name:", error);
		return undefined;
	}
}

// ============================================================================
// DATA NORMALIZATION
// ============================================================================

/**
 * Normalizes invoice data from any source into canonical format
 * This is the SINGLE place where item mapping and GST calculations happen
 */
export async function prepareInvoiceDocumentData(
	source: InvoiceDocumentSource
): Promise<InvoiceDocumentData> {
	const { invoice, items = [], customer, store, profile, storeName } = source;

	// Get served-by name (non-blocking, fetch in parallel if needed)
	const servedByPromise = getServedByName(invoice);

	// Normalize invoice fields (handle both snake_case and camelCase)
	const invoiceNumber =
		invoice.invoice_number || invoice.invoiceNumber || "N/A";
	const invoiceDate =
		invoice.invoice_date || invoice.invoiceDate || new Date().toISOString();
	const dueDate = invoice.due_date || invoice.dueDate;
	const isGstInvoice = invoice.is_gst_invoice || invoice.isGstInvoice || false;

	// Normalize customer fields
	const customerName = customer?.name || "";
	const customerEmail = customer?.email || "";
	const customerPhone = customer?.phone || "";
	const customerGSTIN = customer?.gstin || "";

	// Normalize business fields (store takes precedence over profile)
	const businessName =
		store?.name || storeName || profile?.business_name || "Business";
	const businessGSTIN = store?.gstin || profile?.business_gstin || "";
	const businessAddress =
		store?.address || profile?.business_address || "";
	const businessPhone = store?.phone || profile?.business_phone || "";
	const businessEmail = profile?.business_email || "";
	const logoUrl = profile?.logo_url || "";

	// Normalize items - SINGLE SOURCE OF TRUTH for item mapping
	// This logic is NOT duplicated anywhere else
	const normalizedItems = items.map((item: any) => {
		const quantity = Number(item.quantity) || 0;
		const unitPrice = Number(item.unit_price || item.unitPrice) || 0;
		const discountPercent = Number(item.discount_percent || item.discountPercent) || 0;
		const gstRate = Number(item.gst_rate || item.gstRate) || 0;

		// Calculate using shared GST calculator (single source of truth)
		const calc = calculateLineItem({
			unitPrice,
			discountPercent,
			gstRate,
			quantity,
		});

		return {
			description: item.description || "",
			quantity,
			unitPrice,
			discountPercent,
			gstRate,
			lineTotal: item.line_total || item.lineTotal || (calc.taxableAmount + calc.gstAmount),
			gstAmount: item.gst_amount || item.gstAmount || calc.gstAmount,
		};
	});

	// Normalize totals
	const subtotal = Number(invoice.subtotal) || 0;
	const cgstAmount = Number(invoice.cgst_amount || invoice.cgstAmount) || 0;
	const sgstAmount = Number(invoice.sgst_amount || invoice.sgstAmount) || 0;
	const igstAmount = Number(invoice.igst_amount || invoice.igstAmount) || 0;
	const totalAmount = Number(invoice.total_amount || invoice.totalAmount) || 0;

	// Wait for served-by name
	const servedBy = await servedByPromise;

	return {
		invoiceNumber,
		invoiceDate,
		dueDate,
		customerName,
		customerEmail,
		customerPhone,
		customerGSTIN,
		businessName,
		businessGSTIN,
		businessAddress,
		businessPhone,
		businessEmail,
		logoUrl,
		servedBy,
		items: normalizedItems,
		subtotal,
		cgstAmount,
		sgstAmount,
		igstAmount,
		totalAmount,
		notes: invoice.notes,
		terms: invoice.terms,
		isGstInvoice,
	};
}

// ============================================================================
// PDF GENERATION
// ============================================================================

/**
 * Generates PDF based on format and action requirements
 * 
 * Rules:
 * - Invoice (A4) → Always client-side (fast, reliable)
 * - Slip (80mm):
 *   - WhatsApp → Server-side if online, client-side if offline
 *   - Print/Download → Client-side (no network needed)
 */
async function generatePDF(
	data: InvoiceDocumentData,
	format: DocumentFormat,
	action: DocumentAction
): Promise<Blob> {
	if (format === "invoice") {
		// Invoice (A4) → Always client-side
		const pdfData: InvoicePDFData = {
			...data,
			businessEmail: data.businessEmail,
			logoUrl: data.logoUrl,
			servedBy: data.servedBy,
		};
		return await generateInvoicePDF(pdfData);
	} else {
		// Slip (80mm)
		const slipData: InvoiceSlipData = {
			...data,
			logoUrl: data.logoUrl,
			servedBy: data.servedBy,
		};

		// Determine generation mode
		let useServerSide = false;
		if (action === "whatsapp" && navigator.onLine) {
			// WhatsApp + online → server-side for speed
			useServerSide = true;
		}
		// Print/Download → client-side (no network needed)

		return await generateInvoiceSlipPDF(slipData, { useServerSide });
	}
}

// ============================================================================
// ACTION EXECUTION
// ============================================================================

/**
 * Main entry point for all invoice document actions
 * 
 * UI components should ONLY call this function
 */
export async function executeInvoiceAction(
	options: ExecuteInvoiceActionOptions
): Promise<void> {
	const { invoiceId, action, format = "invoice", source, onProgress } = options;

	try {
		// Step 1: Fetch invoice data (if not provided)
		onProgress?.("Loading invoice data...");
		const invoiceSource = await fetchInvoiceData(invoiceId, source);

		// Step 2: Normalize data (SINGLE SOURCE OF TRUTH)
		onProgress?.("Preparing document...");
		const documentData = await prepareInvoiceDocumentData(invoiceSource);

		// Step 3: Execute action
		switch (action) {
			case "print":
				await handlePrint(documentData, format);
				break;
			case "download":
				await handleDownload(documentData, format);
				break;
			case "whatsapp":
				await handleWhatsApp(documentData, invoiceId, format);
				break;
			case "r2-upload":
				await handleR2Upload(documentData, invoiceId, format);
				break;
		}
	} catch (error) {
		console.error("[InvoiceDocumentEngine] Error:", error);
		throw error;
	}
}

/**
 * Handles print action
 */
async function handlePrint(
	data: InvoiceDocumentData,
	format: DocumentFormat
): Promise<void> {
	const pdfBlob = await generatePDF(data, format, "print");
	const fileName =
		format === "invoice"
			? `Invoice-${data.invoiceNumber}.pdf`
			: `Invoice-Slip-${data.invoiceNumber}.pdf`;

	// Open PDF in new window for printing
	const url = URL.createObjectURL(pdfBlob);
	const printWindow = window.open(url, "_blank");

	if (!printWindow) {
		// Popup blocked - fallback to download
		const downloadLink = document.createElement("a");
		downloadLink.href = url;
		downloadLink.download = fileName;
		document.body.appendChild(downloadLink);
		downloadLink.click();
		document.body.removeChild(downloadLink);
		URL.revokeObjectURL(url);
		return;
	}

	// Wait for window to load, then trigger print
	printWindow.onload = () => {
		// Minimal delay to ensure PDF is rendered
		setTimeout(() => {
			printWindow.print();
			// Cleanup after print dialog is shown
			setTimeout(() => {
				URL.revokeObjectURL(url);
			}, 500);
		}, 300);
	};
}

/**
 * Handles download action
 */
async function handleDownload(
	data: InvoiceDocumentData,
	format: DocumentFormat
): Promise<void> {
	const pdfBlob = await generatePDF(data, format, "download");
	const fileName =
		format === "invoice"
			? `Invoice-${data.invoiceNumber}.pdf`
			: `Invoice-Slip-${data.invoiceNumber}.pdf`;

	const url = URL.createObjectURL(pdfBlob);
	const a = document.createElement("a");
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Handles WhatsApp sharing
 * Opens WhatsApp immediately, PDF generation happens in background if needed
 */
async function handleWhatsApp(
	data: InvoiceDocumentData,
	invoiceId: string,
	format: DocumentFormat
): Promise<void> {
	// Generate invoice link
	const invoiceLink = `${
		typeof window !== "undefined" ? window.location.origin : ""
	}/i/${invoiceId}`;

	// Quick check for existing R2 URL (non-blocking)
	let existingR2Url: string | undefined;
	getInvoiceStorage(invoiceId)
		.then((storage) => {
			if (storage?.public_url) {
				const expiresAt = new Date(storage.expires_at).getTime();
				const now = Date.now();
				if (expiresAt > now) {
					existingR2Url = storage.public_url;
				}
			}
		})
		.catch(() => {
			// Ignore errors
		});

	// Generate WhatsApp message immediately
	const whatsappMessage = generateWhatsAppBillMessage({
		storeName: data.businessName,
		invoiceNumber: data.invoiceNumber,
		invoiceDate: data.invoiceDate,
		items: data.items.map((item) => ({
			name: item.description,
			quantity: item.quantity,
			unitPrice: item.unitPrice,
		})),
		totalAmount: data.totalAmount,
		invoiceLink,
		pdfR2Url: existingR2Url,
	});

	// Open WhatsApp immediately (non-blocking)
	shareOnWhatsApp(whatsappMessage).catch((err) => {
		console.error("[InvoiceDocumentEngine] Failed to open WhatsApp:", err);
	});

	// Trigger background PDF generation and R2 upload (fire-and-forget)
	// Only if no existing URL found and we're online
	if (!existingR2Url && navigator.onLine && !isIndexedDbMode()) {
		fetch("/api/invoices/generate-pdf-and-upload", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ invoiceId }),
		}).catch((err) => {
			console.error(
				"[InvoiceDocumentEngine] Failed to trigger background PDF generation:",
				err
			);
		});
	}
}

/**
 * Handles R2 upload (background operation)
 */
async function handleR2Upload(
	data: InvoiceDocumentData,
	invoiceId: string,
	format: DocumentFormat
): Promise<void> {
	// This is typically called from background API, not directly from UI
	// But kept here for completeness
	const pdfBlob = await generatePDF(data, format, "r2-upload");
	
	// Upload logic is handled by API route
	// This function exists for potential future direct calls
	throw new Error("R2 upload should be handled by API route");
}

