"use client";

/**
 * Generate a compact invoice slip PDF using HTML-to-PDF conversion
 * Supports both server-side (Puppeteer) and client-side (html2canvas) generation
 */
import type { InvoiceData } from "./pdf-generator";
import { generateInvoiceSlipPDFClient } from "./invoice-slip-pdf-client";

export interface InvoiceSlipData extends InvoiceData {
	logoUrl?: string;
	servedBy?: string;
}

export async function generateInvoiceSlipPDF(
	data: InvoiceSlipData,
	options?: { useServerSide?: boolean }
): Promise<Blob> {
	const useServerSide = options?.useServerSide ?? false;

	if (useServerSide) {
		// Use server-side Puppeteer for faster, higher-quality generation
		// This is better for WhatsApp sharing where speed matters
		const baseUrl =
			typeof window !== "undefined"
				? window.location.origin
				: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

		try {
			console.log("[InvoiceSlipPDF] Attempting server-side generation...");
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
				const errorText = await response.text();
				console.error(
					"[InvoiceSlipPDF] Server error:",
					response.status,
					errorText
				);
				throw new Error(
					`Server PDF generation failed: ${
						response.status
					} ${errorText.substring(0, 100)}`
				);
			}

			const blob = await response.blob();
			if (!blob || blob.size === 0) {
				throw new Error("Server returned empty PDF blob");
			}

			console.log(
				"[InvoiceSlipPDF] Server-side generation successful, size:",
				blob.size
			);
			return blob;
		} catch (error) {
			console.warn(
				"[InvoiceSlipPDF] Server-side generation failed, falling back to client-side:",
				error
			);
			// Fallback to client-side if server fails
			return await generateInvoiceSlipPDFClient(data);
		}
	}

	// Default: Use client-side generation (works offline, no server dependency)
	return await generateInvoiceSlipPDFClient(data);
}
