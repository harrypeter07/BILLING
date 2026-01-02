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
    format: [80, 210] // Thin, tall format like a mini bill - slightly taller
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
  const primaryColor = [59, 130, 246] // Bright Blue (#3b82f6)
  const accentColor = [34, 197, 94] // Bright Green (#22c55e)
  const headerColor = [30, 41, 59] // Dark slate (#1e293b)
  const textColor = [51, 65, 85] // Slate gray (#334155)
  const lightBg = [248, 250, 252] // Slate 50
  const borderColor = [226, 232, 240] // Slate 200

  // Header with gradient-like effect
  doc.setFillColor(...headerColor)
  doc.rect(0, 0, pageWidth, 14, 'F')
  
  // Add a subtle border line
  doc.setDrawColor(...borderColor)
  doc.setLineWidth(0.1)
  doc.line(0, 14, pageWidth, 14)
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text("INVOICE", pageWidth / 2, 9, { align: "center" })
  
  yPosition = 17

  // Business Name - colorful accent with border
  doc.setFillColor(...primaryColor)
  doc.roundedRect(2, yPosition - 1, pageWidth - 4, 6, 1, 1, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.text(data.businessName, pageWidth / 2, yPosition + 2.5, { align: "center" })
  yPosition += 8

  // Invoice Details - elegant card style
  doc.setFillColor(...lightBg)
  doc.setDrawColor(...borderColor)
  doc.setLineWidth(0.2)
  doc.roundedRect(2, yPosition, pageWidth - 4, 7, 1, 1, 'FD')
  
  doc.setTextColor(...textColor)
  doc.setFontSize(7.5)
  doc.setFont(undefined, 'bold')
  doc.text(`Invoice #: ${data.invoiceNumber}`, 4, yPosition + 2.5)
  doc.setFont(undefined, 'normal')
  doc.text(`Date: ${new Date(data.invoiceDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}`, 4, yPosition + 5)
  yPosition += 9

  // Customer Info - if available
  if (data.customerName) {
    doc.setFillColor(239, 246, 255) // Light blue
    doc.setDrawColor(...borderColor)
    doc.setLineWidth(0.2)
    doc.roundedRect(2, yPosition, pageWidth - 4, 5, 1, 1, 'FD')
    
    doc.setTextColor(...textColor)
    doc.setFontSize(7.5)
    doc.setFont(undefined, 'bold')
    doc.text(`Bill To:`, 4, yPosition + 2)
    doc.setFont(undefined, 'normal')
    doc.text(data.customerName, 4, yPosition + 3.5)
    yPosition += 7
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

  // Totals Section - elegant card with gradient effect
  doc.setFillColor(...accentColor)
  doc.setDrawColor(28, 163, 75) // Darker green border
  doc.setLineWidth(0.3)
  doc.roundedRect(2, yPosition - 1, pageWidth - 4, 9, 1.5, 1.5, 'FD')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont(undefined, 'bold')
  
  doc.text("Subtotal:", 4, yPosition + 2.5)
  doc.text(`₹${data.subtotal.toFixed(2)}`, pageWidth - 4, yPosition + 2.5, { align: "right" })
  yPosition += 2.8

  if (data.isGstInvoice) {
    if (data.cgstAmount > 0) {
      doc.setFontSize(7.5)
      doc.setFont(undefined, 'normal')
      doc.text("CGST:", 4, yPosition + 1.8)
      doc.setFont(undefined, 'bold')
      doc.text(`₹${data.cgstAmount.toFixed(2)}`, pageWidth - 4, yPosition + 1.8, { align: "right" })
      yPosition += 2.2
    }
    if (data.sgstAmount > 0) {
      doc.setFontSize(7.5)
      doc.setFont(undefined, 'normal')
      doc.text("SGST:", 4, yPosition + 1.8)
      doc.setFont(undefined, 'bold')
      doc.text(`₹${data.sgstAmount.toFixed(2)}`, pageWidth - 4, yPosition + 1.8, { align: "right" })
      yPosition += 2.2
    }
    if (data.igstAmount > 0) {
      doc.setFontSize(7.5)
      doc.setFont(undefined, 'normal')
      doc.text("IGST:", 4, yPosition + 1.8)
      doc.setFont(undefined, 'bold')
      doc.text(`₹${data.igstAmount.toFixed(2)}`, pageWidth - 4, yPosition + 1.8, { align: "right" })
      yPosition += 2.2
    }
  }

  // Total - extra bold with separator line
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.2)
  doc.line(4, yPosition, pageWidth - 4, yPosition)
  yPosition += 1.5
  
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.text("TOTAL:", 4, yPosition + 2)
  doc.text(`₹${data.totalAmount.toFixed(2)}`, pageWidth - 4, yPosition + 2, { align: "right" })

  // Footer - elegant thank you message
  yPosition = pageHeight - 10
  doc.setFillColor(...lightBg)
  doc.setDrawColor(...borderColor)
  doc.setLineWidth(0.2)
  doc.roundedRect(2, yPosition, pageWidth - 4, 8, 1, 1, 'FD')
  
  doc.setTextColor(...textColor)
  doc.setFontSize(7)
  doc.setFont(undefined, 'bold')
  doc.text("Thank you for your business!", pageWidth / 2, yPosition + 3.5, { align: "center" })
  doc.setFont(undefined, 'italic')
  doc.setFontSize(6)
  doc.text("We appreciate your trust in us", pageWidth / 2, yPosition + 5.5, { align: "center" })

  // Convert to blob and ensure correct MIME type
  const pdfBlob = doc.output('blob')
  
  // Ensure the blob has the correct MIME type (jsPDF should set this, but we normalize it)
  if (pdfBlob.type !== 'application/pdf') {
    return new Blob([pdfBlob], { type: 'application/pdf' })
  }
  
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
