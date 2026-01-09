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
			// Configure html2canvas for optimized size: scale 1.0, JPEG compression
			const canvas = await html2canvas(container, {
				scale: 1.0, // CRITICAL: Reduced to 1.0 for smaller PDF size (target < 500KB)
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
					
					// CRITICAL: Force ALL elements to use rgb() colors to prevent lab() parsing errors
					// html2canvas cannot parse lab(), oklch(), or other modern color functions
					// Directly override inline styles on all elements to force rgb() format
					const allElements = clonedDoc.querySelectorAll("*");
					allElements.forEach((el) => {
						const htmlEl = el as HTMLElement;
						
						// Force color to rgb() format - override any computed styles
						// This prevents html2canvas from encountering lab() colors
						htmlEl.style.setProperty("color", "rgb(15, 23, 42)", "important");
						
						// Only override background if it's not transparent
						const currentBg = htmlEl.style.backgroundColor || "";
						if (currentBg && !currentBg.includes("transparent") && !currentBg.includes("rgba(0, 0, 0, 0)")) {
							// Keep existing background but ensure it's rgb format
							htmlEl.style.setProperty("background-color", currentBg, "important");
						}
						
						// Force all border colors to rgb() if they exist
						["border-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color"].forEach((prop) => {
							const currentBorder = htmlEl.style.getPropertyValue(prop);
							if (currentBorder && !currentBorder.includes("transparent")) {
								htmlEl.style.setProperty(prop, currentBorder, "important");
							}
						});
					});
					
					// Add comprehensive CSS override that forces rgb() for all color properties
					// This is the primary defense against lab() color parsing errors
					const style = clonedDoc.createElement("style");
					style.textContent = `
						/* CRITICAL: Force ALL colors to rgb() format - prevents lab() parsing errors in html2canvas */
						/* html2canvas cannot parse modern color functions like lab(), oklch(), etc. */
						* {
							/* Override any computed colors with explicit rgb() values */
							color: rgb(15, 23, 42) !important;
							background-color: transparent !important;
							border-color: transparent !important;
							outline-color: transparent !important;
							text-decoration-color: transparent !important;
							column-rule-color: transparent !important;
						}
						body {
							background-color: rgb(255, 255, 255) !important;
							color: rgb(15, 23, 42) !important;
						}
						.slip-container {
							background-color: rgb(255, 255, 255) !important;
						}
						.business-name, .customer-label {
							color: rgb(236, 72, 153) !important;
						}
						.divider {
							border-top-color: rgb(249, 168, 212) !important;
							border-top-width: 1px !important;
							border-top-style: solid !important;
						}
						.invoice-info, .invoice-info *, .customer-name {
							color: rgb(15, 23, 42) !important;
						}
						.items-table thead, .items-table thead * {
							background-color: rgb(236, 72, 153) !important;
							color: rgb(255, 255, 255) !important;
						}
						.items-table th {
							background-color: rgb(236, 72, 153) !important;
							color: rgb(255, 255, 255) !important;
						}
						.items-table td {
							border-bottom-color: rgb(226, 232, 240) !important;
							border-bottom-width: 0.5px !important;
							border-bottom-style: solid !important;
							color: rgb(15, 23, 42) !important;
						}
						.totals, .total-row, .total-row * {
							color: rgb(15, 23, 42) !important;
						}
						.total-row.bold, .total-row.bold * {
							border-top-color: rgb(236, 72, 153) !important;
							border-top-width: 2px !important;
							border-top-style: solid !important;
							color: rgb(236, 72, 153) !important;
						}
						.footer, .footer * {
							color: rgb(100, 116, 139) !important;
							border-top-color: rgb(226, 232, 240) !important;
							border-top-width: 1px !important;
							border-top-style: solid !important;
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

			// Create PDF from canvas with auto height support for long bills
			// CRITICAL: Use JPEG instead of PNG for 70% size reduction
			const imgData = canvas.toDataURL("image/jpeg", 0.65); // JPEG quality 0.65 (target < 500KB)
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
			const pageHeight = 200; // Standard slip page height in mm
			const pageWidth = 80; // Slip width in mm
			const margin = 6; // Margin in mm
			const usableHeight = pageHeight - margin * 2; // Usable height per page

			// Create first page with compression enabled
			const pdf = new jsPDF({
				orientation: "portrait",
				unit: "mm",
				format: [pageWidth, pageHeight],
				compress: true, // CRITICAL: Enable PDF compression for smaller file size
			});

			// Split image across multiple pages by cropping canvas sections
			let yPosition = 0; // Current Y position in the source image
			let pageNumber = 0;

			while (yPosition < imgHeight) {
				if (pageNumber > 0) {
					pdf.addPage([pageWidth, pageHeight], "portrait");
				}

				// Calculate how much of the image fits on this page
				const remainingHeight = imgHeight - yPosition;
				const pageContentHeight = Math.min(usableHeight, remainingHeight);
				
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
					
					// Convert cropped canvas to JPEG for smaller size
					const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.65); // JPEG quality 0.65
					
					// Add to PDF
					pdf.addImage(
						pageImgData,
						"JPEG", // Changed from PNG to JPEG
						margin,
						margin,
						imgWidth - margin * 2,
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
