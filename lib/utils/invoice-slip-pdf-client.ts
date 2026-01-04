"use client";

/**
 * Client-side HTML to PDF generation (Slip)
 * Uses jsPDF + html2canvas to convert HTML to PDF
 */
import type { InvoiceSlipData } from "./invoice-slip-pdf";
import { generateSlipHTML } from "./invoice-slip-html-generator";

// Cache imports to prevent HMR issues
let jsPDFCache: any = null;
let html2canvasCache: any = null;
let importPromise: Promise<void> | null = null;

async function loadLibraries() {
	if (jsPDFCache && html2canvasCache) {
		return { jsPDF: jsPDFCache, html2canvas: html2canvasCache };
	}

	// If already importing, wait for that promise
	if (importPromise) {
		await importPromise;
		return { jsPDF: jsPDFCache, html2canvas: html2canvasCache };
	}

	// Start new import
	importPromise = (async () => {
		try {
			const [jsPDFModule, html2canvasModule] = await Promise.all([
				import("jspdf"),
				import("html2canvas"),
			]);
			jsPDFCache = jsPDFModule.default || (jsPDFModule as any);
			html2canvasCache = html2canvasModule.default || html2canvasModule;
		} catch (error) {
			// Clear cache on error to allow retry
			jsPDFCache = null;
			html2canvasCache = null;
			importPromise = null;
			throw error;
		}
	})();

	try {
		await importPromise;
		return { jsPDF: jsPDFCache, html2canvas: html2canvasCache };
	} catch (error) {
		// Retry once after delay for HMR issues
		console.warn("[InvoiceSlipPDFClient] Import failed, retrying...", error);
		await new Promise((resolve) => setTimeout(resolve, 200));

		const [jsPDFModule, html2canvasModule] = await Promise.all([
			import("jspdf"),
			import("html2canvas"),
		]);
		jsPDFCache = jsPDFModule.default || (jsPDFModule as any);
		html2canvasCache = html2canvasModule.default || html2canvasModule;
		return { jsPDF: jsPDFCache, html2canvas: html2canvasCache };
	} finally {
		importPromise = null;
	}
}

export async function generateInvoiceSlipPDFClient(
	data: InvoiceSlipData
): Promise<Blob> {
	try {
		const { jsPDF, html2canvas } = await loadLibraries();

		if (!jsPDF || !html2canvas) {
			throw new Error("Failed to load PDF libraries (jsPDF or html2canvas)");
		}

		// Create a completely isolated container that won't affect the main page
		// Use fixed positioning with high z-index and make it invisible
		const container = document.createElement("div");
		container.style.position = "fixed";
		container.style.top = "0";
		container.style.left = "0";
		container.style.width = "80mm";
		container.style.height = "200mm"; // Slip height
		container.style.zIndex = "-9999";
		container.style.opacity = "0";
		container.style.pointerEvents = "none";
		container.style.overflow = "hidden";
		container.style.isolation = "isolate"; // Create new stacking context
		container.innerHTML = generateSlipHTML(data);
		document.body.appendChild(container);

		try {
			// Convert HTML to canvas
			// Configure html2canvas to handle color parsing issues
			const canvas = await html2canvas(container, {
				scale: 2,
				useCORS: true,
				logging: false,
				width: 302, // 80mm in pixels at 96 DPI
				windowWidth: 302,
				ignoreElements: (element: HTMLElement) => {
					// Ignore elements that might cause color parsing issues
					return false;
				},
				onclone: (clonedDoc: Document) => {
					// Force all colors to use hex/rgb format to avoid lab() color issues
					// This converts any lab(), oklch(), or other unsupported color formats to rgb()
					const style = clonedDoc.createElement("style");
					style.textContent = `
						/* Convert all color properties to rgb() format to avoid lab() parsing errors */
						* {
							/* Reset all color-related properties to use rgb() */
							color: rgb(15, 23, 42) !important;
							background-color: transparent !important;
							border-color: transparent !important;
						}
						/* Slip specific colors */
						body {
							background-color: rgb(255, 255, 255) !important;
							color: rgb(15, 23, 42) !important;
						}
						.slip-container {
							background-color: rgb(255, 255, 255) !important;
						}
						.business-name {
							color: rgb(236, 72, 153) !important;
						}
						.divider {
							border-top-color: rgb(249, 168, 212) !important;
						}
						.invoice-info {
							color: rgb(15, 23, 42) !important;
						}
						.customer-label {
							color: rgb(236, 72, 153) !important;
						}
						.customer-name {
							color: rgb(15, 23, 42) !important;
						}
						.items-table thead {
							background-color: rgb(236, 72, 153) !important;
							color: rgb(255, 255, 255) !important;
						}
						.items-table td {
							border-bottom-color: rgb(226, 232, 240) !important;
							color: rgb(15, 23, 42) !important;
						}
						.total-row {
							color: rgb(15, 23, 42) !important;
						}
						.total-row.bold {
							border-top-color: rgb(236, 72, 153) !important;
							color: rgb(236, 72, 153) !important;
						}
						.footer {
							color: rgb(100, 116, 139) !important;
							border-top-color: rgb(226, 232, 240) !important;
						}
					`;
					clonedDoc.head.appendChild(style);
				},
			});

			if (!canvas) {
				throw new Error("html2canvas failed to generate canvas");
			}

			// Create PDF from canvas
			const pdf = new jsPDF({
				orientation: "portrait",
				unit: "mm",
				format: [80, 200], // Custom slip size
			});

			const imgData = canvas.toDataURL("image/png", 1.0);
			if (!imgData || imgData === "data:,") {
				throw new Error("Failed to convert canvas to image data");
			}

			const imgWidth = 80; // Slip width in mm
			const imgHeight = (canvas.height * imgWidth) / canvas.width;

			pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);

			const blob = pdf.output("blob");
			if (!blob || !(blob instanceof Blob)) {
				throw new Error("PDF output is not a valid Blob");
			}

			// Clean up
			if (document.body.contains(container)) {
				document.body.removeChild(container);
			}

			return blob;
		} catch (error) {
			// Clean up on error
			if (document.body.contains(container)) {
				document.body.removeChild(container);
			}
			// Re-throw with more context
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			throw new Error(`Slip PDF generation failed: ${errorMessage}`);
		}
	} catch (error) {
		// Ensure error is properly formatted
		if (error instanceof Error) {
			throw error;
		}
		throw new Error(`Slip PDF generation failed: ${String(error)}`);
	}
}
