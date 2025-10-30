import jsPDF from "jspdf"
import type { Invoice, InvoiceItem, Customer } from "@/lib/db/dexie"

export interface InvoiceData {
  invoice: Invoice
  items: InvoiceItem[]
  customer?: Customer | null
  businessName: string
  businessGSTIN: string
  businessAddress: string
  businessPhone: string
  logoUrl?: string
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Blob> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let yPosition = 10

  // Header
  doc.setFontSize(20)
  doc.text("INVOICE", pageWidth / 2, yPosition, { align: "center" })
  yPosition += 10

  // Business Info
  doc.setFontSize(10)
  doc.text(data.businessName, 10, yPosition)
  yPosition += 5
  doc.setFontSize(8)
  doc.text(`GSTIN: ${data.businessGSTIN}`, 10, yPosition)
  yPosition += 4
  doc.text(`Address: ${data.businessAddress}`, 10, yPosition)
  yPosition += 4
  doc.text(`Phone: ${data.businessPhone}`, 10, yPosition)
  yPosition += 8

  // Invoice Details
  doc.setFontSize(9)
  doc.text(`Invoice #: ${data.invoice.invoice_number}`, 10, yPosition)
  doc.text(`Date: ${new Date(data.invoice.invoice_date).toLocaleDateString()}`, pageWidth / 2, yPosition)
  yPosition += 5
  doc.text(
    `Due Date: ${data.invoice.due_date ? new Date(data.invoice.due_date).toLocaleDateString() : "N/A"}`,
    pageWidth / 2,
    yPosition,
  )
  yPosition += 8

  // Customer Info
  if (data.customer) {
    doc.setFontSize(9)
    doc.text("Bill To:", 10, yPosition)
    yPosition += 4
    doc.setFontSize(8)
    doc.text(data.customer.name, 10, yPosition)
    yPosition += 3
    if (data.customer.email) doc.text(`Email: ${data.customer.email}`, 10, yPosition), (yPosition += 3)
    if (data.customer.phone) doc.text(`Phone: ${data.customer.phone}`, 10, yPosition), (yPosition += 3)
    if (data.customer.gstin) doc.text(`GSTIN: ${data.customer.gstin}`, 10, yPosition), (yPosition += 3)
    yPosition += 4
  }

  // Items Table
  const tableStartY = yPosition
  const columns = ["Item", "Qty", "Unit Price", "Discount %", "GST %", "Amount"]
  const columnWidths = [40, 15, 25, 20, 15, 30]
  let currentX = 10

  // Table Header
  doc.setFontSize(8)
  doc.setFillColor(200, 200, 200)
  columns.forEach((col, i) => {
    doc.text(col, currentX, yPosition, { align: "center" })
    currentX += columnWidths[i]
  })
  yPosition += 5

  // Table Rows
  doc.setFillColor(255, 255, 255)
  data.items.forEach((item) => {
    currentX = 10
    doc.text(item.description.substring(0, 15), currentX, yPosition)
    currentX += columnWidths[0]
    doc.text(item.quantity.toString(), currentX, yPosition, { align: "center" })
    currentX += columnWidths[1]
    doc.text(`₹${item.unit_price.toFixed(2)}`, currentX, yPosition, { align: "right" })
    currentX += columnWidths[2]
    doc.text(`${item.discount_percent}%`, currentX, yPosition, { align: "center" })
    currentX += columnWidths[3]
    doc.text(`${item.gst_rate}%`, currentX, yPosition, { align: "center" })
    currentX += columnWidths[4]
    doc.text(`₹${item.line_total.toFixed(2)}`, currentX, yPosition, { align: "right" })
    yPosition += 5
  })

  yPosition += 5

  // Totals
  doc.setFontSize(9)
  doc.text(`Subtotal: ₹${data.invoice.subtotal.toFixed(2)}`, pageWidth - 50, yPosition)
  yPosition += 5

  if (data.invoice.discount_amount > 0) {
    doc.text(`Discount: -₹${data.invoice.discount_amount.toFixed(2)}`, pageWidth - 50, yPosition)
    yPosition += 5
  }

  if (data.invoice.is_gst_invoice) {
    if (data.invoice.cgst_amount > 0) {
      doc.text(`CGST (9%): ₹${data.invoice.cgst_amount.toFixed(2)}`, pageWidth - 50, yPosition)
      yPosition += 5
    }
    if (data.invoice.sgst_amount > 0) {
      doc.text(`SGST (9%): ₹${data.invoice.sgst_amount.toFixed(2)}`, pageWidth - 50, yPosition)
      yPosition += 5
    }
    if (data.invoice.igst_amount > 0) {
      doc.text(`IGST (18%): ₹${data.invoice.igst_amount.toFixed(2)}`, pageWidth - 50, yPosition)
      yPosition += 5
    }
  }

  doc.setFontSize(11)
  doc.setFont(undefined, "bold")
  doc.text(`Total: ₹${data.invoice.total_amount.toFixed(2)}`, pageWidth - 50, yPosition)

  // Status
  yPosition = pageHeight - 30
  doc.setFontSize(8)
  doc.text(`Status: ${data.invoice.status.toUpperCase()}`, 10, yPosition)
  if (data.invoice.notes) {
    doc.text(`Notes: ${data.invoice.notes}`, 10, yPosition + 5)
  }

  return doc.output("blob")
}
