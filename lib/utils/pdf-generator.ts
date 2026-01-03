export interface InvoiceData {
  invoiceNumber: string
  invoiceDate: string
  dueDate?: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  customerGSTIN?: string
  businessName: string
  businessGSTIN?: string
  businessAddress?: string
  businessPhone?: string
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    discountPercent: number
    gstRate: number
    lineTotal: number
    gstAmount: number
  }>
  subtotal: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalAmount: number
  notes?: string
  terms?: string
  isGstInvoice: boolean
}

/**
 * Shared InvoiceData interface used by invoice-pdf.ts and invoice-slip-pdf.ts
 * This file only exports the interface - actual PDF generation is in:
 * - invoice-pdf.ts (for full A4 invoices)
 * - invoice-slip-pdf.ts (for compact slips)
 */
