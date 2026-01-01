/**
 * Generate a beautiful, colorful mini invoice PDF for WhatsApp sharing
 * Designed to be thin, compact, and visually appealing like a mini bill
 */
import type { InvoiceData } from "./pdf-generator"

export async function generateMiniInvoicePDF(data: InvoiceData): Promise<Blob> {
  // Dynamically import for client-side Next.js compatibility
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200] // Thin, tall format like a mini bill
  })
  
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
  const pageHeight = doc.internal.pageSize.getHeight()
  let yPosition = 5

  // Color scheme - vibrant and professional
  const primaryColor = [41, 128, 185] // Blue
  const accentColor = [46, 204, 113] // Green
  const headerColor = [52, 73, 94] // Dark blue-gray
  const textColor = [44, 62, 80] // Dark gray

  // Header with colorful background
  doc.setFillColor(...headerColor)
  doc.rect(0, 0, pageWidth, 12, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont(undefined, 'bold')
  doc.text("INVOICE", pageWidth / 2, 8, { align: "center" })
  
  yPosition = 15

  // Business Name - colorful accent
  doc.setFillColor(...primaryColor)
  doc.rect(2, yPosition - 2, pageWidth - 4, 5, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont(undefined, 'bold')
  doc.text(data.businessName, pageWidth / 2, yPosition + 1.5, { align: "center" })
  yPosition += 7

  // Invoice Details - compact colorful boxes
  doc.setFillColor(245, 245, 245)
  doc.rect(2, yPosition, pageWidth - 4, 6, 'F')
  
  doc.setTextColor(...textColor)
  doc.setFontSize(7)
  doc.setFont(undefined, 'normal')
  doc.text(`Invoice #: ${data.invoiceNumber}`, 4, yPosition + 2)
  doc.text(`Date: ${new Date(data.invoiceDate).toLocaleDateString("en-IN")}`, 4, yPosition + 4.5)
  yPosition += 8

  // Customer Info - if available
  if (data.customerName) {
    doc.setFillColor(230, 244, 255)
    doc.rect(2, yPosition, pageWidth - 4, 5, 'F')
    
    doc.setTextColor(...textColor)
    doc.setFontSize(7)
    doc.text(`Bill To: ${data.customerName}`, 4, yPosition + 3)
    yPosition += 6
  }

  yPosition += 2

  // Items Table - colorful and compact
  const tableColumns = ["Item", "Qty", "Rate", "Total"]
  
  const tableData = data.items.map((item) => {
    const quantity = Number(item.quantity) || 0
    const unitPrice = Number(item.unitPrice) || 0
    const lineTotal = Number(item.lineTotal) || 0
    
    return [
      (item.description || '').substring(0, 20), // Truncate long names
      quantity.toString(),
      `₹${unitPrice.toFixed(0)}`,
      `₹${lineTotal.toFixed(0)}`,
    ]
  })

  ;(doc as any).autoTable({
    columns: tableColumns,
    body: tableData,
    startY: yPosition,
    theme: "striped",
    headStyles: { 
      fillColor: primaryColor, 
      textColor: 255,
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: { 
      fontSize: 6,
      textColor: textColor,
      cellPadding: 1
    },
    alternateRowStyles: { 
      fillColor: [250, 250, 250]
    },
    columnStyles: {
      0: { cellWidth: 35, halign: 'left' },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 15, halign: 'right' },
      3: { cellWidth: 18, halign: 'right', fontStyle: 'bold' }
    },
    margin: { top: yPosition, left: 2, right: 2 },
    tableWidth: pageWidth - 4,
  })

  yPosition = (doc as any).lastAutoTable.finalY + 3

  // Totals Section - colorful highlight
  doc.setFillColor(...accentColor)
  doc.rect(2, yPosition - 1, pageWidth - 4, 8, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont(undefined, 'bold')
  
  doc.text("Subtotal:", 4, yPosition + 2)
  doc.text(`₹${data.subtotal.toFixed(2)}`, pageWidth - 4, yPosition + 2, { align: "right" })
  yPosition += 2.5

  if (data.isGstInvoice) {
    if (data.cgstAmount > 0) {
      doc.setFontSize(7)
      doc.text("CGST:", 4, yPosition + 1.5)
      doc.text(`₹${data.cgstAmount.toFixed(2)}`, pageWidth - 4, yPosition + 1.5, { align: "right" })
      yPosition += 2
    }
    if (data.sgstAmount > 0) {
      doc.setFontSize(7)
      doc.text("SGST:", 4, yPosition + 1.5)
      doc.text(`₹${data.sgstAmount.toFixed(2)}`, pageWidth - 4, yPosition + 1.5, { align: "right" })
      yPosition += 2
    }
    if (data.igstAmount > 0) {
      doc.setFontSize(7)
      doc.text("IGST:", 4, yPosition + 1.5)
      doc.text(`₹${data.igstAmount.toFixed(2)}`, pageWidth - 4, yPosition + 1.5, { align: "right" })
      yPosition += 2
    }
  }

  // Total - extra bold
  doc.setFontSize(10)
  doc.setFont(undefined, 'bold')
  doc.text("TOTAL:", 4, yPosition + 2)
  doc.text(`₹${data.totalAmount.toFixed(2)}`, pageWidth - 4, yPosition + 2, { align: "right" })

  // Footer - thank you message
  yPosition = pageHeight - 8
  doc.setFillColor(240, 240, 240)
  doc.rect(0, yPosition, pageWidth, 8, 'F')
  
  doc.setTextColor(...textColor)
  doc.setFontSize(6)
  doc.setFont(undefined, 'italic')
  doc.text("Thank you for your business!", pageWidth / 2, yPosition + 4, { align: "center" })
  doc.text("Visit us again!", pageWidth / 2, yPosition + 6, { align: "center" })

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
