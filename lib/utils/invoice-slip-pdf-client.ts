"use client";

/**
 * Client-side HTML to PDF generation for offline mode (Slip)
 * Uses jsPDF + html2canvas to convert HTML to PDF
 */
import type { InvoiceSlipData } from "./invoice-slip-pdf";
import { generateSlipHTML } from "./invoice-slip-html-generator";

export async function generateInvoiceSlipPDFClient(
	data: InvoiceSlipData
): Promise<Blob> {
	// Dynamically import to avoid SSR issues and HMR conflicts
	let jsPDF: any;
	let html2canvas: any;

	try {
		const [jsPDFModule, html2canvasModule] = await Promise.all([
			import("jspdf"),
			import("html2canvas"),
		]);
		jsPDF = jsPDFModule.default || (jsPDFModule as any);
		html2canvas = html2canvasModule.default || html2canvasModule;
	} catch (importError) {
		// Handle HMR issues - retry once
		console.warn(
			"[InvoiceSlipPDFClient] Import failed, retrying...",
			importError
		);
		await new Promise((resolve) => setTimeout(resolve, 100));
		const [jsPDFModule, html2canvasModule] = await Promise.all([
			import("jspdf"),
			import("html2canvas"),
		]);
		jsPDF = jsPDFModule.default || (jsPDFModule as any);
		html2canvas = html2canvasModule.default || html2canvasModule;
	}

	// Create a temporary container for the HTML
	const container = document.createElement("div");
	container.style.position = "absolute";
	container.style.left = "-9999px";
	container.style.width = "80mm"; // Slip width
	container.innerHTML = generateSlipHTML(data);
	document.body.appendChild(container);

	try {
		// Convert HTML to canvas
		const canvas = await html2canvas(container, {
			scale: 2,
			useCORS: true,
			logging: false,
			width: 302, // 80mm in pixels at 96 DPI
			windowWidth: 302,
		});

		// Create PDF from canvas
		const pdf = new jsPDF({
			orientation: "portrait",
			unit: "mm",
			format: [80, 200], // Custom slip size
		});

		const imgData = canvas.toDataURL("image/png", 1.0);
		const imgWidth = 80; // Slip width in mm
		const imgHeight = (canvas.height * imgWidth) / canvas.width;

		pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);

		// Clean up
		document.body.removeChild(container);

		return pdf.output("blob");
	} catch (error) {
		// Clean up on error
		if (document.body.contains(container)) {
			document.body.removeChild(container);
		}
		throw error;
	}
}
