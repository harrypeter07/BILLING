"use client"

import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import { generateInvoicePDF } from "@/lib/utils/pdf-generator"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"

interface InvoicePrintProps {
  invoiceId: string
  invoiceNumber: string
}

export function InvoicePrint({ invoiceId, invoiceNumber }: InvoicePrintProps) {
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)

  const handlePrint = async () => {
    setIsGenerating(true)
    try {
      const supabase = createClient()
      
      // Fetch invoice data
      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single()

      if (invError || !invoice) {
        throw new Error("Failed to fetch invoice")
      }

      const { data: items, error: itemsError } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)

      if (itemsError) {
        throw new Error("Failed to fetch invoice items")
      }

      const { data: customer, error: custError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", invoice.customer_id)
        .single()

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .single()

      // Generate PDF
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
        description: "Invoice PDF generated. Opening print dialog...",
      })

      // Trigger print dialog after a short delay
      setTimeout(() => {
        window.print()
      }, 500)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to generate invoice PDF",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Button 
      onClick={handlePrint} 
      variant="outline" 
      disabled={isGenerating}
      className="gap-2"
    >
      <Printer className="h-4 w-4" />
      {isGenerating ? "Generating..." : "Print Invoice"}
    </Button>
  )
}

