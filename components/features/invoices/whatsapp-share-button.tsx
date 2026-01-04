"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { MessageCircle, WifiOff, Copy, Check, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { generateWhatsAppBillMessage, shareOnWhatsApp, type MiniBillData } from "@/lib/utils/whatsapp-bill"
import { generateInvoiceSlipPDF } from "@/lib/utils/invoice-slip-pdf"
import { getServedByName } from "@/lib/utils/get-served-by"
import { uploadInvoicePDFToR2Client } from "@/lib/utils/invoice-r2-client"
import { saveInvoiceStorage, getInvoiceStorage } from "@/lib/utils/save-invoice-storage"
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
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

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

      // Generate base WhatsApp message (without Drive link)
      const baseMessage = generateWhatsAppBillMessage(miniBillData)

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

      // Generate invoice slip PDF using new HTML-to-PDF design
      // This uses the modern client-side HTML-to-PDF generation (html2canvas + jsPDF)
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

        const pdfBlob = await generateInvoiceSlipPDF(pdfData)
        const fileName = `Invoice-${invoice.invoice_number}.pdf`

        // Get admin/user ID for R2 upload
        let adminId = invoice.user_id || invoice.created_by_employee_id || ""
        if (!adminId) {
          try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              adminId = user.id
            }
          } catch (err) {
            console.warn("[WhatsAppShare] Failed to get user ID:", err)
          }
        }

        // ALWAYS use Cloudflare R2 link - check for existing URL first, then upload if needed
        let r2PublicUrl: string | undefined
        
        if (adminId) {
          // First, check if we already have an R2 URL for this invoice
          console.log("[WhatsAppShare] Checking for existing R2 URL...")
          const existingStorage = await getInvoiceStorage(invoice.id)
          
          if (existingStorage && existingStorage.public_url) {
            // Check if URL hasn't expired
            const expiresAt = new Date(existingStorage.expires_at).getTime()
            const now = Date.now()
            
            if (expiresAt > now) {
              // Use existing valid URL
              r2PublicUrl = existingStorage.public_url
              setUploadedUrl(existingStorage.public_url)
              console.log("[WhatsAppShare] Using existing R2 URL:", r2PublicUrl)
              
              // Auto-copy link to clipboard
              try {
                await navigator.clipboard.writeText(r2PublicUrl)
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 2000)
              } catch (clipboardError) {
                // Clipboard failed, continue anyway
              }
            } else {
              console.log("[WhatsAppShare] Existing R2 URL expired, uploading new one...")
            }
          }
          
          // If no existing valid URL, upload new one
          if (!r2PublicUrl) {
            toast({
              title: "Uploading PDF...",
              description: "Uploading to cloud storage, then opening WhatsApp...",
              duration: 2000,
            })

            // Wait for upload to complete (no timeout - we need the R2 link)
            console.log("[WhatsAppShare] Uploading PDF to R2...")
            const uploadResult = await uploadInvoicePDFToR2Client(
              pdfBlob,
              adminId,
              invoice.id,
              invoice.invoice_number
            )
            
            if (uploadResult.success && uploadResult.publicUrl) {
              r2PublicUrl = uploadResult.publicUrl
              setUploadedUrl(uploadResult.publicUrl)
              console.log("[WhatsAppShare] R2 upload successful:", r2PublicUrl)

              // Save metadata to database (non-blocking)
              if (uploadResult.expiresAt) {
                saveInvoiceStorage({
                  invoice_id: invoice.id,
                  r2_object_key: uploadResult.objectKey || "",
                  public_url: uploadResult.publicUrl,
                  expires_at: uploadResult.expiresAt,
                }).catch((err) => {
                  console.warn("[WhatsAppShare] Failed to save storage metadata (non-critical):", err)
                })
              }

              // Auto-copy link to clipboard
              try {
                await navigator.clipboard.writeText(uploadResult.publicUrl)
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 2000)
              } catch (clipboardError) {
                // Clipboard failed, continue anyway
              }
            } else {
              console.error("[WhatsAppShare] R2 upload failed:", uploadResult.error)
              toast({
                title: "Upload Failed",
                description: "Failed to upload PDF. Opening WhatsApp with invoice link instead.",
                variant: "destructive",
                duration: 3000,
              })
            }
          }
        }

        // Upload is already awaited above, so r2PublicUrl is ready
        // ALWAYS use R2 link if available - never fall back to invoice link for WhatsApp share
        const finalMessage = generateWhatsAppBillMessage({
          ...miniBillData,
          pdfR2Url: r2PublicUrl, // Always use R2 URL if we have it
        })

        console.log("[WhatsAppShare] Opening WhatsApp with message:", finalMessage.substring(0, 100) + "...")
        console.log("[WhatsAppShare] R2 URL:", r2PublicUrl || "Not available")

        // Open WhatsApp with the message (includes R2 link if upload succeeded)
        const shareResult = await shareOnWhatsApp(finalMessage, pdfBlob, fileName)
        
        if (shareResult.success) {
          toast({
            title: r2PublicUrl ? "✅ WhatsApp Opened with PDF Link!" : "✅ WhatsApp Opened",
            description: r2PublicUrl 
              ? "PDF uploaded! WhatsApp opened with shareable PDF link. Link copied to clipboard."
              : "WhatsApp opened. PDF is being uploaded in the background.",
            duration: 3000,
          })
        } else {
          toast({
            title: "Failed to Open WhatsApp",
            description: "Please try opening WhatsApp manually or check your browser settings.",
            variant: "destructive",
            duration: 5000,
          })
        }
      } catch (pdfError) {
        console.warn("[WhatsAppShare] PDF generation failed, sharing text only:", pdfError)
        await shareOnWhatsApp(baseMessage)
        toast({
          title: "Opening WhatsApp",
          description: "PDF generation failed. Opening WhatsApp with text message only.",
          variant: "default",
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

  const handleCopyLink = async () => {
    if (uploadedUrl) {
      try {
        await navigator.clipboard.writeText(uploadedUrl)
        setLinkCopied(true)
        toast({
          title: "Link Copied!",
          description: "PDF link has been copied to clipboard.",
          duration: 2000,
        })
        setTimeout(() => setLinkCopied(false), 2000)
      } catch (err) {
        toast({
          title: "Copy Failed",
          description: "Failed to copy link. Please copy manually.",
          variant: "destructive",
        })
      }
    }
  }

  const handleOpenLink = () => {
    if (uploadedUrl) {
      window.open(uploadedUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <>
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

      <Dialog open={showLinkModal} onOpenChange={setShowLinkModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>PDF Uploaded Successfully!</DialogTitle>
            <DialogDescription>
              Your invoice PDF has been uploaded to cloud storage. The link has been copied to your clipboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <code className="flex-1 text-xs break-all">{uploadedUrl}</code>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {linkCopied && (
                <span className="flex items-center gap-1 text-green-600">
                  <Check className="h-4 w-4" />
                  Copied!
                </span>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="w-full sm:w-auto"
            >
              <Copy className="h-4 w-4 mr-2" />
              {linkCopied ? "Copied!" : "Copy Link"}
            </Button>
            <Button
              onClick={handleOpenLink}
              className="w-full sm:w-auto"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

