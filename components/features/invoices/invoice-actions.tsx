"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreVertical, Download, Edit2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { generateInvoicePDF } from "@/lib/utils/pdf-generator"

interface InvoiceActionsProps {
  invoiceId: string
  invoiceNumber: string
}

export function InvoiceActions({ invoiceId, invoiceNumber }: InvoiceActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const handleDownloadPDF = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).single()

      const { data: items } = await supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId)

      const { data: customer } = await supabase.from("customers").select("*").eq("id", invoice.customer_id).single()

      const { data: profile } = await supabase.from("user_profiles").select("*").single()

      generateInvoicePDF({
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        customerName: customer?.name,
        customerEmail: customer?.email,
        customerPhone: customer?.phone,
        customerGSTIN: customer?.gstin,
        businessName: profile?.business_name || "Business",
        businessGSTIN: profile?.business_gstin,
        businessAddress: profile?.business_address,
        businessPhone: profile?.business_phone,
        items: items || [],
        subtotal: invoice.subtotal,
        cgstAmount: invoice.cgst_amount,
        sgstAmount: invoice.sgst_amount,
        igstAmount: invoice.igst_amount,
        totalAmount: invoice.total_amount,
        notes: invoice.notes,
        terms: invoice.terms,
        isGstInvoice: invoice.is_gst_invoice,
      })

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
      const supabase = createClient()
      await supabase.from("invoices").delete().eq("id", invoiceId)

      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      })

      router.push("/invoices")
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete invoice",
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
