"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { MessageCircle, WifiOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateWhatsAppBillMessage, shareOnWhatsApp, type MiniBillData } from "@/lib/utils/whatsapp-bill"
import { generateMiniInvoicePDF } from "@/lib/utils/mini-invoice-pdf"

interface WhatsAppShareButtonProps {
  invoice: {
    id: string
    invoice_number: string
    invoice_date: string
    total_amount: number
  }
  items: Array<{
    description: string
    quantity: number
    unit_price: number
  }>
  storeName: string
  invoiceLink: string
}

export function WhatsAppShareButton({
  invoice,
  items,
  storeName,
  invoiceLink,
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

      // Generate mini invoice PDF
      try {
        const pdfData = {
          invoiceNumber: invoice.invoice_number,
          invoiceDate: invoice.invoice_date,
          customerName: "",
          customerEmail: "",
          customerPhone: "",
          customerGSTIN: "",
          businessName: storeName || "Business",
          businessGSTIN: "",
          businessAddress: "",
          businessPhone: "",
          items: items.map((item) => {
            const lineTotal = item.quantity * item.unit_price
            return {
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unit_price,
              discountPercent: 0,
              gstRate: 0,
              lineTotal: lineTotal,
              gstAmount: 0,
            }
          }),
          subtotal: invoice.total_amount,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          totalAmount: invoice.total_amount,
          isGstInvoice: false,
        }

        const pdfBlob = await generateMiniInvoicePDF(pdfData)
        shareOnWhatsApp(message, pdfBlob, `Invoice-${invoice.invoice_number}.pdf`)
      } catch (pdfError) {
        console.warn("[WhatsAppShare] PDF generation failed, sharing text only:", pdfError)
        shareOnWhatsApp(message)
      }

      // Show success feedback
      toast({
        title: "Opening WhatsApp",
        description: "WhatsApp is opening with your invoice. PDF has been downloaded - please attach it manually.",
        duration: 5000,
      })
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

