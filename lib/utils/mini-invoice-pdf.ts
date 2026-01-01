/**
 * Generate a mini invoice PDF for WhatsApp sharing
 */
import type { InvoiceData } from "./pdf-generator"

export async function generateMiniInvoicePDF(data: InvoiceData): Promise<Blob> {
  // Dynamically import for client-side Next.js compatibility
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])
  
  const doc = new jsPDF()
  
  // Setup autoTable
  const autoTableFn = autoTableModule.default || autoTableModule.applyPlugin || (autoTableModule as any)
  
  if (typeof autoTableFn === 'function') {
    (doc as any).autoTable = function(this: any, options: any) {
      return autoTableFn(this, options)
    }
  } else if (autoTableModule.applyPlugin && typeof autoTableModule.applyPlugin === 'function') {
    autoTableModule.applyPlugin(jsPDF)
  }
  
  const pageWidth = doc.internal.pageSize.getWidth()
  let yPosition = 10

  // Header - Compact
  doc.setFontSize(16)
  doc.text("INVOICE", pageWidth / 2, yPosition, { align: "center" })
  yPosition += 8

  // Business Info - Compact
  doc.setFontSize(10)
  doc.text(data.businessName, pageWidth / 2, yPosition, { align: "center" })
  yPosition += 5

  // Invoice Details - Compact
  doc.setFontSize(9)
  doc.text(`Invoice #: ${data.invoiceNumber}`, 10, yPosition)
  doc.text(`Date: ${new Date(data.invoiceDate).toLocaleDateString("en-IN")}`, pageWidth - 10, yPosition, { align: "right" })
  yPosition += 6

  // Customer Info - Compact
  if (data.customerName) {
    doc.setFontSize(8)
    doc.text(`Bill To: ${data.customerName}`, 10, yPosition)
    yPosition += 4
  }

  yPosition += 2

  // Items Table - Compact
  const tableColumns = data.isGstInvoice
    ? ["Item", "Qty", "Rate", "Total"]
    : ["Item", "Qty", "Rate", "Total"]

  const tableData = data.items.map((item) => {
    const quantity = Number(item.quantity) || 0
    const unitPrice = Number(item.unitPrice) || 0
    const lineTotal = Number(item.lineTotal) || 0
    
    return [
      (item.description || '').substring(0, 25), // Truncate long names
      quantity.toString(),
      `₹${unitPrice.toFixed(2)}`,
      `₹${lineTotal.toFixed(2)}`,
    ]
  })

  ;(doc as any).autoTable({
    columns: tableColumns,
    body: tableData,
    startY: yPosition,
    theme: "striped",
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    margin: { top: yPosition },
  })

  yPosition = (doc as any).lastAutoTable.finalY + 8

  // Totals - Compact
  doc.setFontSize(9)
  const totalX = pageWidth - 50

  doc.text("Subtotal:", totalX, yPosition)
  doc.text(`₹${data.subtotal.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })
  yPosition += 5

  if (data.isGstInvoice) {
    if (data.cgstAmount > 0) {
      doc.text("CGST:", totalX, yPosition)
      doc.text(`₹${data.cgstAmount.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })
      yPosition += 5
    }
    if (data.sgstAmount > 0) {
      doc.text("SGST:", totalX, yPosition)
      doc.text(`₹${data.sgstAmount.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })
      yPosition += 5
    }
    if (data.igstAmount > 0) {
      doc.text("IGST:", totalX, yPosition)
      doc.text(`₹${data.igstAmount.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })
      yPosition += 5
    }
  }

  doc.setFontSize(11)
  doc.setFont(undefined, "bold")
  doc.text("Total:", totalX, yPosition)
  doc.text(`₹${data.totalAmount.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })

  // Convert to blob
  const pdfBlob = doc.output('blob')
  return pdfBlob
}

/**
 * Convert PDF blob to data URL for sharing
 */
export function pdfBlobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

