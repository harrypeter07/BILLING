/**
 * Generate a compact invoice slip PDF using HTML-to-PDF conversion
 * Uses server-side puppeteer for high-quality PDF generation
 */
import type { InvoiceData } from "./pdf-generator";

export interface InvoiceSlipData extends InvoiceData {
	logoUrl?: string;
	servedBy?: string;
}

export async function generateInvoiceSlipPDF(
	data: InvoiceSlipData
): Promise<Blob> {
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
				type: "slip",
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
