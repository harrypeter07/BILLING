/**
 * Generate a beautiful, high-quality A4 invoice PDF using HTML-to-PDF conversion
 * Uses server-side puppeteer when online, client-side jsPDF/html2canvas when offline
 */
import type { InvoiceData } from "./pdf-generator";

export interface InvoicePDFData extends InvoiceData {
	businessEmail?: string;
	logoUrl?: string;
	servedBy?: string; // Employee or admin name who generated the invoice
}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Blob> {
	// Check if we're in browser and offline
	const isOffline = typeof window !== "undefined" && !navigator.onLine;

	if (isOffline) {
		// Use client-side HTML to PDF for offline mode
		const { generateInvoicePDFClient } = await import("./invoice-pdf-client");
		return await generateInvoicePDFClient(data);
	}

	// Online: Use server-side puppeteer for better quality
	const baseUrl =
		typeof window !== "undefined"
			? window.location.origin
			: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

	try {
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
			throw new Error("Server PDF generation failed");
		}

		return await response.blob();
	} catch (error) {
		// Fallback to client-side if server fails
		console.warn(
			"[InvoicePDF] Server generation failed, using client-side:",
			error
		);
		const { generateInvoicePDFClient } = await import("./invoice-pdf-client");
		return await generateInvoicePDFClient(data);
	}
}
