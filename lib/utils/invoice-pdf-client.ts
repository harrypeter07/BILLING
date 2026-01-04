/**
 * Client-side HTML to PDF generation for offline mode
 * Uses jsPDF + html2canvas to convert HTML to PDF
 */
import type { InvoicePDFData } from "./invoice-pdf";
import { generateInvoiceHTML } from "./invoice-html-generator";

export async function generateInvoicePDFClient(
	data: InvoicePDFData
): Promise<Blob> {
	// Dynamically import to avoid SSR issues
	const [jsPDFModule, html2canvasModule] = await Promise.all([
		import("jspdf"),
		import("html2canvas"),
	]);

	const jsPDF = jsPDFModule.default || (jsPDFModule as any);
	const html2canvas = html2canvasModule.default || html2canvasModule;

	// Create a temporary container for the HTML
	const container = document.createElement("div");
	container.style.position = "absolute";
	container.style.left = "-9999px";
	container.style.width = "210mm"; // A4 width
	container.innerHTML = generateInvoiceHTML(data);
	document.body.appendChild(container);

	try {
		// Convert HTML to canvas
		const canvas = await html2canvas(container, {
			scale: 2,
			useCORS: true,
			logging: false,
			width: 794, // A4 width in pixels at 96 DPI
			windowWidth: 794,
		});

		// Create PDF from canvas
		const pdf = new jsPDF({
			orientation: "portrait",
			unit: "mm",
			format: "a4",
		});

		const imgData = canvas.toDataURL("image/png", 1.0);
		const imgWidth = 210; // A4 width in mm
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
