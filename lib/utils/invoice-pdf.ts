/**
 * Generate a beautiful, high-quality A4 invoice PDF with professional layout
 * Enhanced design with proper spacing, typography, and visual hierarchy
 */
import type { InvoiceData } from "./pdf-generator"

export interface InvoicePDFData extends InvoiceData {
  businessEmail?: string
  logoUrl?: string
  servedBy?: string // Employee or admin name who generated the invoice
}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Blob> {
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
  let yPosition = 12

  // Enhanced color scheme
  const primaryColor = [59, 130, 246] // Blue (#3b82f6)
  const accentColor = [34, 197, 94] // Green (#22c55e)
  const headerColor = [15, 23, 42] // Slate 900
  const textColor = [30, 41, 59] // Slate 800
  const lightText = [100, 116, 139] // Slate 500
  const lightBg = [248, 250, 252] // Slate 50
  const borderColor = [203, 213, 225] // Slate 300
  const white = [255, 255, 255]

  // Logo in top right corner with better quality
  if (data.logoUrl) {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = data.logoUrl
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            const logoSize = 35
            const logoX = pageWidth - logoSize - 15
            const logoY = 8
            
            const aspectRatio = img.width / img.height
            let logoWidth = logoSize
            let logoHeight = logoSize / aspectRatio
            
            if (logoHeight > logoSize) {
              logoHeight = logoSize
              logoWidth = logoSize * aspectRatio
            }
            
            // Enhanced image quality
            let imageAdded = false
            try {
              const maxLogoPixels = 400
              let compressedWidth = img.width
              let compressedHeight = img.height
              
              if (compressedWidth > maxLogoPixels || compressedHeight > maxLogoPixels) {
                const scale = Math.min(maxLogoPixels / compressedWidth, maxLogoPixels / compressedHeight)
                compressedWidth = Math.floor(compressedWidth * scale)
                compressedHeight = Math.floor(compressedHeight * scale)
              }
              
              if (typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined') {
                const canvas = document.createElement('canvas')
                canvas.width = compressedWidth
                canvas.height = compressedHeight
                const ctx = canvas.getContext('2d')
                if (ctx) {
                  ctx.imageSmoothingEnabled = true
                  ctx.imageSmoothingQuality = 'high'
                  ctx.drawImage(img, 0, 0, compressedWidth, compressedHeight)
                  const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.9)
                  doc.addImage(
                    compressedDataUrl,
                    'JPEG',
                    logoX,
                    logoY,
                    logoWidth,
                    logoHeight,
                    undefined,
                    'MEDIUM'
                  )
                  imageAdded = true
                }
              }
            } catch (compressionError) {
              console.warn("[InvoicePDF] Image compression failed, using original:", compressionError)
            }
            
            if (!imageAdded) {
              doc.addImage(
                img,
                'PNG',
                logoX,
                logoY,
                logoWidth,
                logoHeight,
                undefined,
                'MEDIUM'
              )
            }
            resolve(true)
          } catch (error) {
            console.warn("[InvoicePDF] Error adding logo:", error)
            resolve(false)
          }
        }
        img.onerror = () => {
          console.warn("[InvoicePDF] Failed to load logo image")
          resolve(false)
        }
        setTimeout(() => resolve(false), 3000)
      })
    } catch (error) {
      console.warn("[InvoicePDF] Logo loading error:", error)
    }
  }

  // Enhanced Header Section with better spacing
  doc.setFillColor(...headerColor)
  doc.rect(10, yPosition - 7, pageWidth - 20, 12, 'F')
  
  // Accent line
  doc.setFillColor(...primaryColor)
  doc.rect(10, yPosition + 3, pageWidth - 20, 2, 'F')
  
  doc.setTextColor(...white)
  doc.setFontSize(28)
  doc.setFont(undefined, 'bold')
  doc.text("INVOICE", pageWidth / 2, yPosition + 1, { align: "center" })
  yPosition += 18

  // Business Information Section - enhanced layout
  doc.setTextColor(...textColor)
  doc.setFontSize(18)
  doc.setFont(undefined, 'bold')
  doc.text(data.businessName, 10, yPosition)
  yPosition += 8

  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(...lightText)
  
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

  yPosition += 8

  // Invoice Details and Customer Info - enhanced side by side layout
  const leftX = 10
  const rightX = pageWidth / 2 + 5
  const startY = yPosition

  // Left: Invoice Details - enhanced card
  doc.setFillColor(...lightBg)
  doc.setDrawColor(...borderColor)
  doc.setLineWidth(0.3)
  doc.roundedRect(leftX, startY, (pageWidth - 30) / 2, 28, 2, 2, 'FD')
  
  doc.setTextColor(...textColor)
  doc.setFontSize(12)
  doc.setFont(undefined, 'bold')
  doc.text("Invoice Details", leftX + 4, startY + 7)
  
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(...lightText)
  doc.text(`Invoice #:`, leftX + 4, startY + 12)
  doc.setTextColor(...textColor)
  doc.setFont(undefined, 'bold')
  doc.text(data.invoiceNumber, leftX + 4, startY + 16)
  
  doc.setFont(undefined, 'normal')
  doc.setTextColor(...lightText)
  doc.text(`Date:`, leftX + 4, startY + 21)
  doc.setTextColor(...textColor)
  const invoiceDate = new Date(data.invoiceDate).toLocaleDateString("en-IN", { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  })
  doc.text(invoiceDate, leftX + 4, startY + 25)
  
  if (data.dueDate) {
    doc.setTextColor(...lightText)
    doc.text(`Due Date:`, leftX + 4, startY + 29)
    doc.setTextColor(...textColor)
    const dueDate = new Date(data.dueDate).toLocaleDateString("en-IN", { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    })
    doc.text(dueDate, leftX + 4, startY + 33)
  }

  // Right: Customer Info - enhanced card
  if (data.customerName) {
    doc.roundedRect(rightX, startY, (pageWidth - 30) / 2, 28, 2, 2, 'FD')
    
    doc.setFontSize(12)
    doc.setFont(undefined, 'bold')
    doc.setTextColor(...textColor)
    doc.text("Bill To", rightX + 4, startY + 7)
    
    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(...textColor)
    const customerNameLines = doc.splitTextToSize(data.customerName, (pageWidth - 30) / 2 - 8)
    doc.text(customerNameLines, rightX + 4, startY + 12)
    let customerY = startY + 12 + customerNameLines.length * 5
    
    if (data.customerEmail) {
      doc.setTextColor(...lightText)
      doc.text(`Email: ${data.customerEmail}`, rightX + 4, customerY)
      customerY += 5
    }
    if (data.customerPhone) {
      doc.text(`Phone: ${data.customerPhone}`, rightX + 4, customerY)
      customerY += 5
    }
    if (data.customerGSTIN) {
      doc.text(`GSTIN: ${data.customerGSTIN}`, rightX + 4, customerY)
    }
  }

  yPosition = startY + 32

  // Enhanced Items Table with better styling
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
      textColor: white,
      fontSize: 11,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 4
    },
    bodyStyles: { 
      fontSize: 9.5,
      textColor: textColor,
      cellPadding: 3,
      lineWidth: 0.1
    },
    alternateRowStyles: { 
      fillColor: lightBg
    },
    margin: { top: yPosition, left: 10, right: 10 },
    tableWidth: pageWidth - 20,
    styles: {
      lineColor: borderColor,
      lineWidth: 0.1
    }
  })

  yPosition = (doc as any).lastAutoTable.finalY + 12

  // Enhanced Totals Section with better alignment
  const totalX = pageWidth - 90
  doc.setFontSize(10)
  doc.setTextColor(...textColor)
  doc.setFont(undefined, 'normal')
  
  doc.text("Subtotal:", totalX, yPosition)
  doc.setFont(undefined, 'bold')
  doc.text(`₹${data.subtotal.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })
  yPosition += 8

  if (data.isGstInvoice) {
    if (data.cgstAmount > 0) {
      doc.setFont(undefined, 'normal')
      doc.text("CGST:", totalX, yPosition)
      doc.setFont(undefined, 'bold')
      doc.text(`₹${data.cgstAmount.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })
      yPosition += 8
    }
    if (data.sgstAmount > 0) {
      doc.setFont(undefined, 'normal')
      doc.text("SGST:", totalX, yPosition)
      doc.setFont(undefined, 'bold')
      doc.text(`₹${data.sgstAmount.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })
      yPosition += 8
    }
    if (data.igstAmount > 0) {
      doc.setFont(undefined, 'normal')
      doc.text("IGST:", totalX, yPosition)
      doc.setFont(undefined, 'bold')
      doc.text(`₹${data.igstAmount.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })
      yPosition += 8
    }
  }

  // Total - enhanced with border and better styling
  doc.setDrawColor(...primaryColor)
  doc.setLineWidth(0.8)
  doc.line(totalX - 8, yPosition, pageWidth - 10, yPosition)
  yPosition += 5

  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...primaryColor)
  doc.text("Total:", totalX, yPosition)
  doc.text(`₹${data.totalAmount.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })

  yPosition += 12

  // Served By Section
  if (data.servedBy) {
    doc.setFontSize(9)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(...lightText)
    doc.text(`Served by: ${data.servedBy}`, 10, yPosition)
    yPosition += 8
  }

  // Notes and Terms - enhanced styling
  if (data.notes || data.terms) {
    yPosition += 5
    if (data.notes) {
      doc.setFontSize(11)
      doc.setFont(undefined, 'bold')
      doc.setTextColor(...textColor)
      doc.text("Notes:", 10, yPosition)
      yPosition += 6
      doc.setFont(undefined, 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(...lightText)
      const notesLines = doc.splitTextToSize(data.notes || "", pageWidth - 20)
      doc.text(notesLines, 10, yPosition)
      yPosition += notesLines.length * 5 + 8
    }
    if (data.terms) {
      doc.setFontSize(11)
      doc.setFont(undefined, 'bold')
      doc.setTextColor(...textColor)
      doc.text("Terms & Conditions:", 10, yPosition)
      yPosition += 6
      doc.setFont(undefined, 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(...lightText)
      const termsLines = doc.splitTextToSize(data.terms || "", pageWidth - 20)
      doc.text(termsLines, 10, yPosition)
    }
  }

  // Enhanced Footer
  yPosition = pageHeight - 20
  doc.setFontSize(10)
  doc.setFont(undefined, 'italic')
  doc.setTextColor(...lightText)
  doc.text("Thank you for your business!", pageWidth / 2, yPosition, { align: "center" })

  // Convert to blob
  const pdfBlob = doc.output('blob')
  
  if (pdfBlob.type !== 'application/pdf') {
    return new Blob([pdfBlob], { type: 'application/pdf' })
  }
  
  return pdfBlob
}

