/**
 * Generate A4 size invoice PDF with logo in corner and served by field
 */
import type { InvoiceData } from "./pdf-generator"

export interface A4InvoiceData extends InvoiceData {
  businessEmail?: string
  logoUrl?: string
  servedBy?: string // Employee or admin name who generated the invoice
}

export async function generateA4InvoicePDF(data: A4InvoiceData): Promise<Blob> {
  // Dynamically import for client-side Next.js compatibility
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
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
  let yPosition = 15

  // Color scheme
  const primaryColor = [59, 130, 246] // Blue
  const headerColor = [30, 41, 59] // Dark slate
  const textColor = [51, 65, 85] // Slate gray
  const borderColor = [226, 232, 240] // Slate 200
  const lightBg = [248, 250, 252] // Slate 50

  // Logo in top right corner
  if (data.logoUrl) {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = data.logoUrl
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            // Logo size: 30mm x 30mm in top right
            const logoSize = 30
            const logoX = pageWidth - logoSize - 10
            const logoY = 10
            
            // Calculate aspect ratio
            const aspectRatio = img.width / img.height
            let logoWidth = logoSize
            let logoHeight = logoSize / aspectRatio
            
            if (logoHeight > logoSize) {
              logoHeight = logoSize
              logoWidth = logoSize * aspectRatio
            }
            
            doc.addImage(
              img,
              'PNG',
              logoX,
              logoY,
              logoWidth,
              logoHeight
            )
            resolve(true)
          } catch (error) {
            console.warn("[A4PDF] Error adding logo:", error)
            resolve(false)
          }
        }
        img.onerror = () => {
          console.warn("[A4PDF] Failed to load logo image")
          resolve(false)
        }
        // Timeout after 3 seconds
        setTimeout(() => resolve(false), 3000)
      })
    } catch (error) {
      console.warn("[A4PDF] Logo loading error:", error)
    }
  }

  // Header Section
  doc.setFillColor(...headerColor)
  doc.rect(10, yPosition - 5, pageWidth - 20, 8, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont(undefined, 'bold')
  doc.text("INVOICE", pageWidth / 2, yPosition, { align: "center" })
  yPosition += 12

  // Business Information Section
  doc.setTextColor(...textColor)
  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text(data.businessName, 10, yPosition)
  yPosition += 7

  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  
  if (data.businessAddress) {
    const addressLines = doc.splitTextToSize(data.businessAddress, pageWidth - 20)
    doc.text(addressLines, 10, yPosition)
    yPosition += addressLines.length * 5
  }
  
  if (data.businessPhone) {
    doc.text(`Phone: ${data.businessPhone}`, 10, yPosition)
    yPosition += 5
  }
  
  if (data.businessEmail) {
    doc.text(`Email: ${data.businessEmail}`, 10, yPosition)
    yPosition += 5
  }
  
  if (data.businessGSTIN) {
    doc.text(`GSTIN: ${data.businessGSTIN}`, 10, yPosition)
    yPosition += 5
  }

  yPosition += 5

  // Invoice Details and Customer Info Side by Side
  const leftX = 10
  const rightX = pageWidth / 2 + 5
  const startY = yPosition

  // Left: Invoice Details
  doc.setFillColor(...lightBg)
  doc.setDrawColor(...borderColor)
  doc.setLineWidth(0.2)
  doc.roundedRect(leftX, startY, (pageWidth - 30) / 2, 25, 2, 2, 'FD')
  
  doc.setTextColor(...textColor)
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.text("Invoice Details", leftX + 3, startY + 6)
  
  doc.setFontSize(9)
  doc.setFont(undefined, 'normal')
  doc.text(`Invoice #: ${data.invoiceNumber}`, leftX + 3, startY + 11)
  doc.text(`Date: ${new Date(data.invoiceDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}`, leftX + 3, startY + 16)
  
  if (data.dueDate) {
    doc.text(`Due Date: ${new Date(data.dueDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}`, leftX + 3, startY + 21)
  }

  // Right: Customer Info
  if (data.customerName) {
    doc.roundedRect(rightX, startY, (pageWidth - 30) / 2, 25, 2, 2, 'FD')
    
    doc.setFontSize(11)
    doc.setFont(undefined, 'bold')
    doc.text("Bill To", rightX + 3, startY + 6)
    
    doc.setFontSize(9)
    doc.setFont(undefined, 'normal')
    doc.text(data.customerName, rightX + 3, startY + 11)
    
    if (data.customerEmail) {
      doc.text(`Email: ${data.customerEmail}`, rightX + 3, startY + 16)
    }
    if (data.customerPhone) {
      doc.text(`Phone: ${data.customerPhone}`, rightX + 3, startY + 21)
    }
  }

  yPosition = startY + 30

  // Items Table
  const tableColumns = data.isGstInvoice
    ? ["Description", "Qty", "Unit Price", "Discount %", "GST %", "GST Amount", "Total"]
    : ["Description", "Qty", "Unit Price", "Discount %", "Total"]

  const tableData = data.items.map((item) => {
    const quantity = Number(item.quantity) || 0
    const unitPrice = Number(item.unitPrice) || 0
    const discountPercent = Number(item.discountPercent) || 0
    const gstRate = Number(item.gstRate) || 0
    const gstAmount = Number(item.gstAmount) || 0
    const lineTotal = Number(item.lineTotal) || 0
    
    return data.isGstInvoice
      ? [
          item.description || '',
          quantity.toString(),
          `₹${unitPrice.toFixed(2)}`,
          `${discountPercent}%`,
          `${gstRate}%`,
          `₹${gstAmount.toFixed(2)}`,
          `₹${lineTotal.toFixed(2)}`,
        ]
      : [
          item.description || '',
          quantity.toString(),
          `₹${unitPrice.toFixed(2)}`,
          `${discountPercent}%`,
          `₹${lineTotal.toFixed(2)}`,
        ]
  })

  ;(doc as any).autoTable({
    columns: tableColumns,
    body: tableData,
    startY: yPosition,
    theme: "grid",
    headStyles: { 
      fillColor: primaryColor, 
      textColor: 255,
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: { 
      fontSize: 9,
      textColor: textColor,
      cellPadding: 3
    },
    alternateRowStyles: { 
      fillColor: lightBg
    },
    margin: { top: yPosition, left: 10, right: 10 },
    tableWidth: pageWidth - 20,
  })

  yPosition = (doc as any).lastAutoTable.finalY + 10

  // Totals Section
  const totalX = pageWidth - 80
  doc.setFontSize(10)
  doc.setTextColor(...textColor)
  
  doc.text("Subtotal:", totalX, yPosition)
  doc.text(`₹${data.subtotal.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })
  yPosition += 7

  if (data.isGstInvoice) {
    if (data.cgstAmount > 0) {
      doc.text("CGST:", totalX, yPosition)
      doc.text(`₹${data.cgstAmount.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })
      yPosition += 7
    }
    if (data.sgstAmount > 0) {
      doc.text("SGST:", totalX, yPosition)
      doc.text(`₹${data.sgstAmount.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })
      yPosition += 7
    }
    if (data.igstAmount > 0) {
      doc.text("IGST:", totalX, yPosition)
      doc.text(`₹${data.igstAmount.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })
      yPosition += 7
    }
  }

  // Total with border
  doc.setDrawColor(...primaryColor)
  doc.setLineWidth(0.5)
  doc.line(totalX - 5, yPosition, pageWidth - 10, yPosition)
  yPosition += 3

  doc.setFontSize(14)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...primaryColor)
  doc.text("Total:", totalX, yPosition)
  doc.text(`₹${data.totalAmount.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })

  yPosition += 10

  // Served By Section
  if (data.servedBy) {
    doc.setFontSize(9)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(...textColor)
    doc.text(`Served by: ${data.servedBy}`, 10, yPosition)
    yPosition += 5
  }

  // Notes and Terms
  if (data.notes || data.terms) {
    yPosition += 5
    if (data.notes) {
      doc.setFontSize(10)
      doc.setFont(undefined, 'bold')
      doc.text("Notes:", 10, yPosition)
      yPosition += 5
      doc.setFont(undefined, 'normal')
      doc.setFontSize(9)
      const notesLines = doc.splitTextToSize(data.notes || "", pageWidth - 20)
      doc.text(notesLines, 10, yPosition)
      yPosition += notesLines.length * 5 + 5
    }
    if (data.terms) {
      doc.setFontSize(10)
      doc.setFont(undefined, 'bold')
      doc.text("Terms & Conditions:", 10, yPosition)
      yPosition += 5
      doc.setFont(undefined, 'normal')
      doc.setFontSize(9)
      const termsLines = doc.splitTextToSize(data.terms || "", pageWidth - 20)
      doc.text(termsLines, 10, yPosition)
    }
  }

  // Footer
  yPosition = pageHeight - 15
  doc.setFontSize(8)
  doc.setFont(undefined, 'italic')
  doc.setTextColor(128, 128, 128)
  doc.text("Thank you for your business!", pageWidth / 2, yPosition, { align: "center" })

  // Convert to blob
  const pdfBlob = doc.output('blob')
  
  if (pdfBlob.type !== 'application/pdf') {
    return new Blob([pdfBlob], { type: 'application/pdf' })
  }
  
  return pdfBlob
}

