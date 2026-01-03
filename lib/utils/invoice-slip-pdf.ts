/**
 * Generate a beautiful, high-quality invoice slip PDF for WhatsApp sharing
 * Designed to be compact, professional, and visually appealing
 */
import type { InvoiceData } from "./pdf-generator"

export interface InvoiceSlipData extends InvoiceData {
  businessEmail?: string
  logoUrl?: string
  servedBy?: string // Employee or admin name who generated the invoice
}

export async function generateInvoiceSlipPDF(data: InvoiceSlipData): Promise<Blob> {
  // Dynamically import for client-side Next.js compatibility
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 210], // Compact slip format
    compress: true,
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
  let yPosition = 4

  // Enhanced color scheme - modern and professional
  const primaryColor = [59, 130, 246] // Blue (#3b82f6)
  const accentColor = [34, 197, 94] // Green (#22c55e)
  const headerColor = [15, 23, 42] // Slate 900 - darker for better contrast
  const textColor = [30, 41, 59] // Slate 800
  const lightText = [100, 116, 139] // Slate 500
  const lightBg = [248, 250, 252] // Slate 50
  const borderColor = [203, 213, 225] // Slate 300
  const white = [255, 255, 255]

  // Enhanced Header with better spacing
  doc.setFillColor(...headerColor)
  doc.rect(0, 0, pageWidth, 16, 'F')
  
  // Decorative accent line
  doc.setFillColor(...primaryColor)
  doc.rect(0, 14, pageWidth, 2, 'F')
  
  doc.setTextColor(...white)
  doc.setFontSize(18)
  doc.setFont(undefined, 'bold')
  doc.text("INVOICE SLIP", pageWidth / 2, 10, { align: "center" })
  
  yPosition = 18

  // Logo with better quality handling
  if (data.logoUrl) {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = data.logoUrl
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            const logoSize = 22
            const logoX = (pageWidth - logoSize) / 2
            const logoY = yPosition
            
            const aspectRatio = img.width / img.height
            let logoWidth = logoSize
            let logoHeight = logoSize / aspectRatio
            
            if (logoHeight > logoSize) {
              logoHeight = logoSize
              logoWidth = logoSize * aspectRatio
            }
            
            // Enhanced image compression with better quality
            let imageAdded = false
            try {
              const maxLogoPixels = 300 // Increased for better quality
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
                  // Better image rendering quality
                  ctx.imageSmoothingEnabled = true
                  ctx.imageSmoothingQuality = 'high'
                  ctx.drawImage(img, 0, 0, compressedWidth, compressedHeight)
                  const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85) // Higher quality
                  doc.addImage(
                    compressedDataUrl,
                    'JPEG',
                    logoX,
                    logoY,
                    logoWidth,
                    logoHeight,
                    undefined,
                    'MEDIUM' // Better quality than FAST
                  )
                  imageAdded = true
                }
              }
            } catch (compressionError) {
              console.warn("[InvoiceSlip] Image compression failed, using original:", compressionError)
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
            yPosition += logoHeight + 4
            resolve(true)
          } catch (error) {
            console.warn("[InvoiceSlip] Error adding logo:", error)
            resolve(false)
          }
        }
        img.onerror = () => {
          console.warn("[InvoiceSlip] Failed to load logo image")
          resolve(false)
        }
        setTimeout(() => resolve(false), 3000)
      })
    } catch (error) {
      console.warn("[InvoiceSlip] Logo loading error:", error)
    }
  }

  // Business Name - enhanced styling
  doc.setFillColor(...primaryColor)
  doc.roundedRect(2, yPosition - 1, pageWidth - 4, 7, 1.5, 1.5, 'F')
  
  doc.setTextColor(...white)
  doc.setFontSize(12)
  doc.setFont(undefined, 'bold')
  const businessName = doc.splitTextToSize(data.businessName, pageWidth - 8)
  doc.text(businessName, pageWidth / 2, yPosition + 3.5, { align: "center", maxWidth: pageWidth - 8 })
  yPosition += 9

  // Invoice Details - enhanced card with better spacing
  doc.setFillColor(...lightBg)
  doc.setDrawColor(...borderColor)
  doc.setLineWidth(0.3)
  doc.roundedRect(2, yPosition, pageWidth - 4, 8, 1.5, 1.5, 'FD')
  
  doc.setTextColor(...textColor)
  doc.setFontSize(8)
  doc.setFont(undefined, 'bold')
  doc.text(`Invoice #: ${data.invoiceNumber}`, 4, yPosition + 3)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(...lightText)
  doc.setFontSize(7.5)
  const invoiceDate = new Date(data.invoiceDate).toLocaleDateString("en-IN", { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  })
  doc.text(`Date: ${invoiceDate}`, 4, yPosition + 5.5)
  yPosition += 10

  // Customer Info - enhanced styling
  if (data.customerName) {
    doc.setFillColor(239, 246, 255) // Light blue background
    doc.setDrawColor(...primaryColor)
    doc.setLineWidth(0.3)
    doc.roundedRect(2, yPosition, pageWidth - 4, 6, 1.5, 1.5, 'FD')
    
    doc.setTextColor(...textColor)
    doc.setFontSize(8)
    doc.setFont(undefined, 'bold')
    doc.text(`Bill To:`, 4, yPosition + 2.5)
    doc.setFont(undefined, 'normal')
    doc.setFontSize(7.5)
    const customerName = doc.splitTextToSize(data.customerName, pageWidth - 10)
    doc.text(customerName, 4, yPosition + 4.5)
    yPosition += 8
  }

  yPosition += 3

  // Items Table - enhanced with better spacing and alignment
  const tableColumns = ["Item", "Qty", "Rate", "Total"]
  
  const tableData = data.items.map((item) => {
    const quantity = Number(item.quantity) || 0
    const unitPrice = Number(item.unitPrice) || 0
    const lineTotal = Number(item.lineTotal) || 0
    
    return [
      (item.description || '').substring(0, 22), // Slightly longer for better readability
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
      textColor: white,
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2
    },
    bodyStyles: { 
      fontSize: 6.5,
      textColor: textColor,
      cellPadding: 1.5,
      lineWidth: 0.1
    },
    alternateRowStyles: { 
      fillColor: [252, 252, 252]
    },
    columnStyles: {
      0: { cellWidth: 36, halign: 'left' },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 14, halign: 'right' },
      3: { cellWidth: 18, halign: 'right', fontStyle: 'bold' }
    },
    margin: { top: yPosition, left: 2, right: 2 },
    tableWidth: pageWidth - 4,
    styles: {
      lineColor: borderColor,
      lineWidth: 0.1
    }
  })

  yPosition = (doc as any).lastAutoTable.finalY + 4

  // Totals Section - enhanced with better visual hierarchy
  doc.setFillColor(...accentColor)
  doc.setDrawColor(22, 163, 74) // Darker green border
  doc.setLineWidth(0.4)
  doc.roundedRect(2, yPosition - 1, pageWidth - 4, 10, 2, 2, 'FD')
  
  doc.setTextColor(...white)
  doc.setFontSize(8.5)
  doc.setFont(undefined, 'bold')
  
  doc.text("Subtotal:", 4, yPosition + 3)
  doc.text(`₹${data.subtotal.toFixed(2)}`, pageWidth - 4, yPosition + 3, { align: "right" })
  yPosition += 3.2

  if (data.isGstInvoice) {
    if (data.cgstAmount > 0) {
      doc.setFontSize(7.5)
      doc.setFont(undefined, 'normal')
      doc.text("CGST:", 4, yPosition + 2.2)
      doc.setFont(undefined, 'bold')
      doc.text(`₹${data.cgstAmount.toFixed(2)}`, pageWidth - 4, yPosition + 2.2, { align: "right" })
      yPosition += 2.5
    }
    if (data.sgstAmount > 0) {
      doc.setFontSize(7.5)
      doc.setFont(undefined, 'normal')
      doc.text("SGST:", 4, yPosition + 2.2)
      doc.setFont(undefined, 'bold')
      doc.text(`₹${data.sgstAmount.toFixed(2)}`, pageWidth - 4, yPosition + 2.2, { align: "right" })
      yPosition += 2.5
    }
    if (data.igstAmount > 0) {
      doc.setFontSize(7.5)
      doc.setFont(undefined, 'normal')
      doc.text("IGST:", 4, yPosition + 2.2)
      doc.setFont(undefined, 'bold')
      doc.text(`₹${data.igstAmount.toFixed(2)}`, pageWidth - 4, yPosition + 2.2, { align: "right" })
      yPosition += 2.5
    }
  }

  // Total - enhanced with separator
  doc.setDrawColor(...white)
  doc.setLineWidth(0.3)
  doc.line(4, yPosition, pageWidth - 4, yPosition)
  yPosition += 2
  
  doc.setFontSize(12)
  doc.setFont(undefined, 'bold')
  doc.text("TOTAL:", 4, yPosition + 2.5)
  doc.text(`₹${data.totalAmount.toFixed(2)}`, pageWidth - 4, yPosition + 2.5, { align: "right" })

  // Served By Section
  yPosition = pageHeight - 20
  if (data.servedBy) {
    doc.setTextColor(...lightText)
    doc.setFontSize(6.5)
    doc.setFont(undefined, 'normal')
    doc.text(`Served by: ${data.servedBy}`, pageWidth / 2, yPosition, { align: "center" })
    yPosition += 4
  }

  // Enhanced Footer
  doc.setFillColor(...lightBg)
  doc.setDrawColor(...borderColor)
  doc.setLineWidth(0.3)
  doc.roundedRect(2, yPosition, pageWidth - 4, 10, 1.5, 1.5, 'FD')
  
  doc.setTextColor(...textColor)
  doc.setFontSize(7.5)
  doc.setFont(undefined, 'bold')
  doc.text("Thank you for your business!", pageWidth / 2, yPosition + 4, { align: "center" })
  doc.setFont(undefined, 'italic')
  doc.setFontSize(6.5)
  doc.setTextColor(...lightText)
  doc.text("We appreciate your trust in us", pageWidth / 2, yPosition + 6, { align: "center" })

  // Convert to blob with compression
  const pdfBlob = doc.output('blob', {
    compression: true,
  })
  
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

