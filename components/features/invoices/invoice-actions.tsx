"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreVertical, Download, Edit2, Trash2, Printer } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { generateInvoicePDF } from "@/lib/utils/invoice-pdf"

interface InvoiceActionsProps {
  invoiceId: string
  invoiceNumber: string
  invoiceData?: any // Optional: pass invoice data if already loaded
}

export function InvoiceActions({ invoiceId, invoiceNumber, invoiceData }: InvoiceActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const handleDownloadPDF = async () => {
    setIsLoading(true)
    try {
      let invoice: any = null
      let items: any[] = []
      let customer: any = null
      let profile: any = null

      // If invoice data is already provided, use it (avoid API call)
      if (invoiceData) {
        console.log("[InvoiceActions] Using provided invoice data for PDF")
        invoice = invoiceData
        const rawItems = invoice.invoice_items || invoice.items || []
        customer = invoice.customers || invoice.customer || null
        profile = invoice.profile || null
        
        // Transform items to match PDF generator format (snake_case to camelCase)
        items = rawItems.map((item: any) => ({
          description: item.description || '',
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unit_price || item.unitPrice) || 0,
          discountPercent: Number(item.discount_percent || item.discountPercent) || 0,
          gstRate: Number(item.gst_rate || item.gstRate) || 0,
          lineTotal: Number(item.line_total || item.lineTotal) || 0,
          gstAmount: Number(item.gst_amount || item.gstAmount) || 0,
        }))
      } else {
        // Fallback: Fetch from database directly if data not provided
        console.log("[InvoiceActions] Fetching invoice from database (fallback)")
        
        const { isIndexedDbMode } = await import("@/lib/utils/db-mode")
        const { createClient } = await import("@/lib/supabase/client")
        const { db } = await import("@/lib/dexie-client")
        const isIndexedDb = isIndexedDbMode()

        if (isIndexedDb) {
          // Fetch from IndexedDB
          invoice = await db.invoices.get(invoiceId)
          if (!invoice) throw new Error("Invoice not found")
          
          const rawItems = await db.invoice_items
            .where("invoice_id")
            .equals(invoiceId)
            .toArray()
          
          customer = invoice.customer_id 
            ? await db.customers.get(invoice.customer_id)
            : null
          
          // Get profile from Supabase (business settings)
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: prof } = await supabase
              .from("user_profiles")
              .select("*")
              .eq("id", user.id)
              .single()
            profile = prof
          }
          
          items = rawItems.map((item: any) => ({
            description: item.description || '',
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unit_price) || 0,
            discountPercent: Number(item.discount_percent) || 0,
            gstRate: Number(item.gst_rate) || 0,
            lineTotal: Number(item.line_total) || 0,
            gstAmount: Number(item.gst_amount) || 0,
          }))
        } else {
          // Fetch from Supabase
          const supabase = createClient()
          
          const { data: invData, error: invoiceError } = await supabase
            .from("invoices")
            .select("*, customers(*)")
            .eq("id", invoiceId)
            .single()
          
          if (invoiceError || !invData) {
            throw new Error(invoiceError?.message || "Invoice not found")
          }
          
          invoice = invData
          customer = invData.customers || null
          
          const { data: itemsData, error: itemsError } = await supabase
            .from("invoice_items")
            .select("*")
            .eq("invoice_id", invoiceId)
          
          if (itemsError) {
            console.warn("[InvoiceActions] Error fetching items:", itemsError)
          }
          
          const rawItems = itemsData || []
          
          // Get profile
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: prof } = await supabase
              .from("user_profiles")
              .select("*")
              .eq("id", user.id)
              .single()
            profile = prof
          }
          
          items = rawItems.map((item: any) => ({
            description: item.description || '',
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unit_price) || 0,
            discountPercent: Number(item.discount_percent) || 0,
            gstRate: Number(item.gst_rate) || 0,
            lineTotal: Number(item.line_total) || 0,
            gstAmount: Number(item.gst_amount) || 0,
          }))
        }
      }

      const pdfBlob = await generateInvoicePDF({
        invoiceNumber: invoice.invoice_number || invoiceNumber,
        invoiceDate: invoice.invoice_date || invoice.invoiceDate || new Date().toISOString(),
        dueDate: invoice.due_date || invoice.dueDate,
        customerName: customer?.name,
        customerEmail: customer?.email,
        customerPhone: customer?.phone,
        customerGSTIN: customer?.gstin,
        businessName: profile?.business_name || "Business",
        businessGSTIN: profile?.business_gstin,
        businessAddress: profile?.business_address,
        businessPhone: profile?.business_phone,
        businessEmail: profile?.business_email,
        logoUrl: profile?.logo_url,
        items: items || [],
        subtotal: Number(invoice.subtotal) || 0,
        cgstAmount: Number(invoice.cgst_amount || invoice.cgstAmount) || 0,
        sgstAmount: Number(invoice.sgst_amount || invoice.sgstAmount) || 0,
        igstAmount: Number(invoice.igst_amount || invoice.igstAmount) || 0,
        totalAmount: Number(invoice.total_amount || invoice.totalAmount) || 0,
        notes: invoice.notes,
        terms: invoice.terms,
        isGstInvoice: invoice.is_gst_invoice || invoice.isGstInvoice || false,
      })

      // Download the PDF
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Invoice-${invoice.invoice_number || invoiceNumber}.pdf`
      a.click()
      URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: "Invoice PDF downloaded successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this invoice?")) return

    setIsLoading(true)
    try {
      const { isIndexedDbMode } = await import("@/lib/utils/db-mode")
      const isIndexedDb = isIndexedDbMode()

      if (isIndexedDb) {
        // Delete from IndexedDB
        const { storageManager } = await import("@/lib/storage-manager")
        await storageManager.deleteInvoice(invoiceId)
      } else {
        // Delete from Supabase
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        
        // Delete invoice items first (foreign key constraint)
        const { error: itemsError } = await supabase
          .from("invoice_items")
          .delete()
          .eq("invoice_id", invoiceId)
        
        if (itemsError) throw itemsError

        // Delete invoice
        const { error: invoiceError } = await supabase
          .from("invoices")
          .delete()
          .eq("id", invoiceId)
        
        if (invoiceError) throw invoiceError
      }

      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      })

      router.push("/invoices")
      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete invoice",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isLoading}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDownloadPDF}>
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={async () => {
          await handleDownloadPDF()
          setTimeout(() => window.print(), 500)
        }}>
          <Printer className="mr-2 h-4 w-4" />
          Print Invoice
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/invoices/${invoiceId}/edit`)}>
          <Edit2 className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDelete} className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
