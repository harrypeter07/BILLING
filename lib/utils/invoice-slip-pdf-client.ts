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
		// Use absolute positioning off-screen but visible for html2canvas
		const container = document.createElement("div");
		container.style.position = "absolute";
		container.style.top = "0";
		container.style.left = "-9999px";
		container.style.width = "80mm";
		container.style.height = "auto"; // Let height adjust to content
		container.style.zIndex = "-9999";
		container.style.pointerEvents = "none";
		container.style.overflow = "visible";
		container.style.backgroundColor = "white";
		container.style.visibility = "visible"; // Must be visible for html2canvas
		container.style.opacity = "1"; // Must be fully opaque
		container.innerHTML = generateSlipHTML(data);
		document.body.appendChild(container);

		try {
			// Wait longer for the container to fully render and images to load
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Verify container has content
			if (!container.innerHTML || container.innerHTML.trim().length === 0) {
				throw new Error("Container is empty - HTML generation failed");
			}

			console.log(
				"[InvoiceSlipPDFClient] Container ready, generating canvas..."
			);

			// Convert HTML to canvas
			// Configure html2canvas to handle color parsing issues
			const canvas = await html2canvas(container, {
				scale: 1.5, // Reduced from 2 to reduce PDF size
				useCORS: true,
				allowTaint: false, // Prevent tainted canvas
				logging: false,
				width: 302, // 80mm in pixels at 96 DPI
				windowWidth: 302,
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
					// Force all colors to use rgb() format to avoid lab() color issues
					// Ensure pink colors are preserved for slip design
					const style = clonedDoc.createElement("style");
					style.textContent = `
						/* Slip specific colors - Pink design */
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

			// Verify canvas has content
			if (canvas.width === 0 || canvas.height === 0) {
				throw new Error("Canvas is empty - html2canvas captured nothing");
			}

			console.log(
				"[InvoiceSlipPDFClient] Canvas generated:",
				canvas.width,
				"x",
				canvas.height
			);

			// Create PDF from canvas
			const pdf = new jsPDF({
				orientation: "portrait",
				unit: "mm",
				format: [80, 200], // Custom slip size
			});

			const imgData = canvas.toDataURL("image/png", 1.0);
			if (!imgData || imgData === "data:," || imgData.length < 100) {
				throw new Error(
					"Failed to convert canvas to image data - canvas may be blank"
				);
			}

			console.log(
				"[InvoiceSlipPDFClient] Image data generated, size:",
				imgData.length
			);

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
