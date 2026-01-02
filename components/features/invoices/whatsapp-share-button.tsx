"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { MessageCircle, WifiOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateWhatsAppBillMessage, shareOnWhatsApp, type MiniBillData } from "@/lib/utils/whatsapp-bill"
import { generateMiniInvoicePDF } from "@/lib/utils/mini-invoice-pdf"
import { getServedByName } from "@/lib/utils/get-served-by"
import { createClient } from "@/lib/supabase/client"

interface WhatsAppShareButtonProps {
  invoice: {
    id: string
    invoice_number: string
    invoice_date: string
    total_amount: number
    created_by_employee_id?: string
    employee_id?: string
    user_id?: string
    is_gst_invoice?: boolean
    subtotal?: number
    cgst_amount?: number
    sgst_amount?: number
    igst_amount?: number
  }
  items: Array<{
    description: string
    quantity: number
    unit_price: number
    discount_percent?: number
    gst_rate?: number
    line_total?: number
    gst_amount?: number
  }>
  storeName: string
  invoiceLink: string
  customer?: {
    name?: string
    email?: string
    phone?: string
    gstin?: string
  }
  profile?: {
    business_name?: string
    business_gstin?: string
    business_address?: string
    business_phone?: string
    business_email?: string
    logo_url?: string
  }
}

export function WhatsAppShareButton({
  invoice,
  items,
  storeName,
  invoiceLink,
  customer,
  profile,
}: WhatsAppShareButtonProps) {
  const { toast } = useToast()
  const [isOnline, setIsOnline] = useState(true)
  const [isSharing, setIsSharing] = useState(false)

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine)

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const handleShare = async () => {
    if (!isOnline) {
      toast({
        title: "Internet Required",
        description: "Internet connection is required to share invoice on WhatsApp",
        variant: "destructive",
      })
      return
    }

    setIsSharing(true)

    try {
      // Prepare mini bill data
      const miniBillData: MiniBillData = {
        storeName: storeName || "Business",
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        items: items.map((item) => ({
          name: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        })),
        totalAmount: invoice.total_amount,
        invoiceLink: invoiceLink,
      }

      // Generate WhatsApp message
      const message = generateWhatsAppBillMessage(miniBillData)

      // Get served by name
      const servedBy = await getServedByName(invoice)

      // Get profile if not provided
      let businessProfile = profile
      if (!businessProfile) {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: prof } = await supabase
              .from("user_profiles")
              .select("*")
              .eq("id", user.id)
              .single()
            if (prof) {
              businessProfile = prof
            }
          }
        } catch (err) {
          console.warn("[WhatsAppShare] Failed to fetch profile:", err)
        }
      }

      // Generate and download mini invoice PDF
      try {
        const pdfData = {
          invoiceNumber: invoice.invoice_number,
          invoiceDate: invoice.invoice_date,
          customerName: customer?.name || "",
          customerEmail: customer?.email || "",
          customerPhone: customer?.phone || "",
          customerGSTIN: customer?.gstin || "",
          businessName: businessProfile?.business_name || storeName || "Business",
          businessGSTIN: businessProfile?.business_gstin || "",
          businessAddress: businessProfile?.business_address || "",
          businessPhone: businessProfile?.business_phone || "",
          businessEmail: businessProfile?.business_email || "",
          logoUrl: businessProfile?.logo_url || "",
          servedBy: servedBy,
          items: items.map((item) => {
            const quantity = Number(item.quantity) || 0
            const unitPrice = Number(item.unit_price) || 0
            const discountPercent = Number(item.discount_percent || 0)
            const gstRate = Number(item.gst_rate || 0)
            const baseAmount = quantity * unitPrice * (1 - discountPercent / 100)
            const gstAmount = (invoice.is_gst_invoice) 
              ? (baseAmount * gstRate) / 100 
              : Number(item.gst_amount || 0)
            const lineTotal = Number(item.line_total || (baseAmount + gstAmount))
            
            return {
              description: item.description,
              quantity: quantity,
              unitPrice: unitPrice,
              discountPercent: discountPercent,
              gstRate: gstRate,
              lineTotal: lineTotal,
              gstAmount: gstAmount,
            }
          }),
          subtotal: Number(invoice.subtotal || invoice.total_amount) || 0,
          cgstAmount: Number(invoice.cgst_amount || 0),
          sgstAmount: Number(invoice.sgst_amount || 0),
          igstAmount: Number(invoice.igst_amount || 0),
          totalAmount: Number(invoice.total_amount) || 0,
          isGstInvoice: invoice.is_gst_invoice || false,
        }

        const pdfBlob = await generateMiniInvoicePDF(pdfData)
        await shareOnWhatsApp(message, pdfBlob, `Invoice-${invoice.invoice_number}.pdf`)
        
        toast({
          title: "Opening WhatsApp",
          description: "PDF downloaded. WhatsApp is opening with your invoice message. You can attach the downloaded PDF manually.",
          duration: 5000,
        })
      } catch (pdfError) {
        console.warn("[WhatsAppShare] PDF generation failed, sharing text only:", pdfError)
        await shareOnWhatsApp(message)
        toast({
          title: "Opening WhatsApp",
          description: "WhatsApp is opening with your invoice message.",
          duration: 3000,
        })
      }
    } catch (error) {
      console.error("[WhatsAppShare] Error:", error)
      toast({
        title: "Error",
        description: "Failed to prepare WhatsApp message. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <Button
      onClick={handleShare}
      disabled={!isOnline || isSharing}
      variant="outline"
      className="gap-2"
      title={!isOnline ? "Internet required to share invoice" : "Share invoice on WhatsApp"}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span className="hidden sm:inline">Offline</span>
        </>
      ) : (
        <>
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">{isSharing ? "Opening..." : "Share on WhatsApp"}</span>
        </>
      )}
    </Button>
  )
}

