"use client";

/**
 * Client-side HTML to PDF generation
 * Uses jsPDF + html2canvas to convert HTML to PDF
 */
import type { InvoicePDFData } from "./invoice-pdf";
import { generateInvoiceHTML } from "./invoice-html-generator";

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
		console.warn("[InvoicePDFClient] Import failed, retrying...", error);
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

export async function generateInvoicePDFClient(
	data: InvoicePDFData
): Promise<Blob> {
	try {
		const { jsPDF, html2canvas } = await loadLibraries();

		if (!jsPDF || !html2canvas) {
			throw new Error("Failed to load PDF libraries (jsPDF or html2canvas)");
		}

		// Create a completely isolated container that won't affect the main page
		// Use absolute positioning off-screen but visible for html2canvas
		const container = document.createElement("div");
		container.style.position = "absolute";
		container.style.top = "0";
		container.style.left = "-9999px";
		container.style.width = "210mm";
		container.style.height = "auto"; // Let height adjust to content
		container.style.zIndex = "-9999";
		container.style.pointerEvents = "none";
		container.style.overflow = "visible";
		container.style.backgroundColor = "white";
		container.style.visibility = "visible"; // Must be visible for html2canvas
		container.style.opacity = "1"; // Must be fully opaque
		container.innerHTML = generateInvoiceHTML(data);
		document.body.appendChild(container);

		try {
			// Wait longer for the container to fully render and images to load
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Verify container has content
			if (!container.innerHTML || container.innerHTML.trim().length === 0) {
				throw new Error("Container is empty - HTML generation failed");
			}

			console.log("[InvoicePDFClient] Container ready, generating canvas...");

			// Convert HTML to canvas
			// Configure html2canvas to handle color parsing issues
			const canvas = await html2canvas(container, {
				scale: 1.5, // Reduced from 2 to reduce PDF size
				useCORS: true,
				allowTaint: false, // Prevent tainted canvas
				logging: false,
				width: 794, // A4 width in pixels at 96 DPI
				windowWidth: 794,
				backgroundColor: "#ffffff", // Ensure white background
				imageTimeout: 3000, // 3 second timeout for images
				removeContainer: false, // Keep container for cleanup
				ignoreElements: (element: HTMLElement) => {
					// Ignore broken or loading images
					if (element.tagName === "IMG") {
						const img = element as HTMLImageElement;
						if (
							!img.complete ||
							img.naturalWidth === 0 ||
							img.naturalHeight === 0
						) {
							return true;
						}
					}
					return false;
				},
				onclone: (clonedDoc: Document) => {
					// Hide broken images in cloned document
					const images = clonedDoc.querySelectorAll("img");
					images.forEach((img) => {
						const imgEl = img as HTMLImageElement;
						if (
							!imgEl.complete ||
							imgEl.naturalWidth === 0 ||
							imgEl.naturalHeight === 0
						) {
							(imgEl as HTMLElement).style.display = "none";
						}
					});
					// Force all colors to use hex/rgb format to avoid lab() color issues
					// This converts any lab(), oklch(), or other unsupported color formats to rgb()
					const style = clonedDoc.createElement("style");
					style.textContent = `
						/* Convert all color properties to rgb() format to avoid lab() parsing errors */
						* {
							/* Reset all color-related properties to use rgb() */
							color: rgb(30, 41, 59) !important;
							background-color: transparent !important;
							border-color: transparent !important;
						}
						/* Invoice specific colors */
						body {
							background-color: rgb(255, 255, 255) !important;
							color: rgb(30, 41, 59) !important;
						}
						.invoice-container {
							background-color: rgb(255, 255, 255) !important;
						}
						.header {
							border-bottom-color: rgb(59, 130, 246) !important;
						}
						.business-name {
							color: rgb(30, 41, 59) !important;
						}
						.business-details {
							color: rgb(100, 116, 139) !important;
						}
						.invoice-title {
							color: rgb(59, 130, 246) !important;
						}
						.detail-box {
							background-color: rgb(248, 250, 252) !important;
							border-color: rgb(226, 232, 240) !important;
						}
						.detail-label {
							color: rgb(100, 116, 139) !important;
						}
						.detail-value {
							color: rgb(30, 41, 59) !important;
						}
						.items-table thead {
							background-color: rgb(59, 130, 246) !important;
							color: rgb(255, 255, 255) !important;
						}
						.items-table tbody tr:nth-child(even) {
							background-color: rgb(248, 250, 252) !important;
						}
						.items-table td {
							border-bottom-color: rgb(226, 232, 240) !important;
							color: rgb(30, 41, 59) !important;
						}
						.totals-table td:first-child {
							color: rgb(100, 116, 139) !important;
						}
						.totals-table td:last-child {
							color: rgb(30, 41, 59) !important;
						}
						.total-row {
							border-top-color: rgb(59, 130, 246) !important;
						}
						.total-row td {
							color: rgb(59, 130, 246) !important;
						}
						.section-title {
							color: rgb(30, 41, 59) !important;
						}
						.section-content {
							color: rgb(100, 116, 139) !important;
						}
						.footer {
							color: rgb(100, 116, 139) !important;
							border-top-color: rgb(226, 232, 240) !important;
						}
						.served-by {
							color: rgb(148, 163, 184) !important;
						}
						.notes-section, .terms-section {
							border-top-color: rgb(226, 232, 240) !important;
						}
					`;
					clonedDoc.head.appendChild(style);
				},
			});

			if (!canvas) {
				throw new Error("html2canvas failed to generate canvas");
			}

			// Create PDF from canvas with multi-page support for long invoices
			const imgData = canvas.toDataURL("image/png", 1.0);
			if (!imgData || imgData === "data:,") {
				throw new Error("Failed to convert canvas to image data");
			}

			const imgWidth = 210; // A4 width in mm
			const imgHeight = (canvas.height * imgWidth) / canvas.width;
			const pageHeight = 297; // A4 height in mm
			const pageWidth = 210; // A4 width in mm
			const margin = 0; // No margin for invoices

			// Create first page
			const pdf = new jsPDF({
				orientation: "portrait",
				unit: "mm",
				format: "a4",
			});

			// Split image across multiple pages by cropping canvas sections
			let yPosition = 0; // Current Y position in the source image
			let pageNumber = 0;

			while (yPosition < imgHeight) {
				if (pageNumber > 0) {
					pdf.addPage("a4", "portrait");
				}

				// Calculate how much of the image fits on this page
				const remainingHeight = imgHeight - yPosition;
				const pageContentHeight = Math.min(pageHeight, remainingHeight);
				
				// Calculate source coordinates for cropping
				const sourceX = 0;
				const sourceY = (yPosition / imgHeight) * canvas.height;
				const sourceWidth = canvas.width;
				const sourceHeight = (pageContentHeight / imgHeight) * canvas.height;

				// Create a temporary canvas for this page's content
				const pageCanvas = document.createElement("canvas");
				pageCanvas.width = canvas.width;
				pageCanvas.height = sourceHeight;
				const pageCtx = pageCanvas.getContext("2d");
				
				if (pageCtx) {
					// Draw the cropped section to the temporary canvas
					pageCtx.drawImage(
						canvas,
						sourceX, sourceY, sourceWidth, sourceHeight, // Source rectangle
						0, 0, canvas.width, sourceHeight // Destination rectangle
					);
					
					// Convert cropped canvas to image
					const pageImgData = pageCanvas.toDataURL("image/png", 1.0);
					
					// Add to PDF
					pdf.addImage(
						pageImgData,
						"PNG",
						margin,
						margin,
						imgWidth,
						pageContentHeight
					);
				}

				yPosition += pageContentHeight;
				pageNumber++;
			}

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
			throw new Error(`PDF generation failed: ${errorMessage}`);
		}
	} catch (error) {
		// Ensure error is properly formatted
		if (error instanceof Error) {
			throw error;
		}
		throw new Error(`PDF generation failed: ${String(error)}`);
	}
}
