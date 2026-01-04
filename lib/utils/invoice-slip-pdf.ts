"use client";

/**
 * Generate a compact invoice slip PDF using HTML-to-PDF conversion
 * Always uses client-side jsPDF/html2canvas for fast, reliable generation
 */
import type { InvoiceData } from "./pdf-generator";
import { generateInvoiceSlipPDFClient } from "./invoice-slip-pdf-client";

export interface InvoiceSlipData extends InvoiceData {
	logoUrl?: string;
	servedBy?: string;
}

export async function generateInvoiceSlipPDF(
	data: InvoiceSlipData
): Promise<Blob> {
	// Always use client-side generation - it's faster and more reliable
	// No network latency, works offline, and avoids server costs
	return await generateInvoiceSlipPDFClient(data);
}
