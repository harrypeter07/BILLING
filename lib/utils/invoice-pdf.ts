/**
 * Generate a beautiful, high-quality A4 invoice PDF using HTML-to-PDF conversion
 * Uses server-side puppeteer for high-quality PDF generation
 */
import type { InvoiceData } from "./pdf-generator";

export interface InvoicePDFData extends InvoiceData {
	businessEmail?: string;
	logoUrl?: string;
	servedBy?: string; // Employee or admin name who generated the invoice
}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Blob> {
	// Call the API endpoint to generate PDF from HTML
	const baseUrl =
		typeof window !== "undefined"
			? window.location.origin
			: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

	const response = await fetch(
		`${baseUrl}/api/invoices/generate-pdf-from-data`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				data,
				type: "invoice",
			}),
		}
	);

	if (!response.ok) {
		const error = await response
			.json()
			.catch(() => ({ error: "Failed to generate PDF" }));
		throw new Error(error.error || "Failed to generate PDF");
	}

	return await response.blob();
}
