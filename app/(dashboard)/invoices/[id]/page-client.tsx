"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"
import { ArrowLeft, Printer, Share2 } from "lucide-react"
import { InvoiceActions } from "@/components/features/invoices/invoice-actions"
import { InvoicePrint } from "@/components/features/invoices/invoice-print"
import { WhatsAppShareButton } from "@/components/features/invoices/whatsapp-share-button"
import { useToast } from "@/hooks/use-toast"
import { generateMiniInvoicePDF } from "@/lib/utils/mini-invoice-pdf"
import { useInvoice } from "@/lib/hooks/use-cached-data"
import { db } from "@/lib/dexie-client"
import { isIndexedDbMode } from "@/lib/utils/db-mode"
import { createClient } from "@/lib/supabase/client"
import { getServedByName } from "@/lib/utils/get-served-by"

export default function InvoiceDetailPageClient() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const invoiceId = params.id as string
  const { data: invoiceData, isLoading: loading, error } = useInvoice(invoiceId)
  const [settings, setSettings] = useState<any>(null)
  const [storeName, setStoreName] = useState<string>("Business")
  const [isSharingPDF, setIsSharingPDF] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  // Extract invoice, items, and customer from the hook data
  const invoice = invoiceData
  const items = invoiceData?.invoice_items || []
  const customer = invoiceData?.customers

  // Fetch store name for WhatsApp sharing
  useEffect(() => {
    const fetchStoreName = async () => {
      if (!invoice?.store_id) {
        // Try to get from localStorage or use default
        const currentStoreId = localStorage.getItem("currentStoreId")
        if (currentStoreId) {
          const isIndexedDb = isIndexedDbMode()
          if (isIndexedDb) {
            const store = await db.stores.get(currentStoreId)
            if (store?.name) {
              setStoreName(store.name)
            }
          } else {
            const supabase = createClient()
            const { data: store } = await supabase
              .from("stores")
              .select("name")
              .eq("id", currentStoreId)
              .single()
            if (store?.name) {
              setStoreName(store.name)
            }
          }
        }
        return
      }

      try {
        const isIndexedDb = isIndexedDbMode()
        if (isIndexedDb) {
          const store = await db.stores.get(invoice.store_id)
          if (store?.name) {
            setStoreName(store.name)
          }
        } else {
          const supabase = createClient()
          const { data: store } = await supabase
            .from("stores")
            .select("name")
            .eq("id", invoice.store_id)
            .single()
          if (store?.name) {
            setStoreName(store.name)
          }
        }
      } catch (err) {
        console.warn("[InvoiceDetail] Failed to fetch store name:", err)
      }
    }

    if (invoice) {
      fetchStoreName()
    }
  }, [invoice])

  useEffect(() => {
    if (error) {
      toast({ title: "Error", description: "Invoice not found", variant: "destructive" })
    }
  }, [error, toast])

  // Fetch business settings for printing and sharing
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`/api/invoices/${invoiceId}`)
        const data = await response.json()
        if (data.profile) {
          setSettings(data.profile)
          setProfile(data.profile)
        }
      } catch (err) {
        console.warn("Failed to fetch business settings:", err)
      }
    }
    if (invoiceId) {
      fetchSettings()
    }
  }, [invoiceId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">Loading invoice...</p>
        </div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error ? String(error) : "Invoice not found"}</p>
          <Button asChild>
            <Link href="/invoices">Back to Invoices</Link>
          </Button>
        </div>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    sent: "bg-blue-100 text-blue-800",
    paid: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  }

  // Share PDF using Web Share API - uses only IndexedDB data (no Supabase)
  const handleSharePDF = async () => {
    if (!invoice || !items || items.length === 0) {
      toast({
        title: "Error",
        description: "Invoice data not available",
        variant: "destructive",
      })
      return
    }

    setIsSharingPDF(true)

    try {
      // Check if Web Share API is supported
      if (!navigator.share || !navigator.canShare) {
        toast({
          title: "Not Supported",
          description: "Web Share API is not supported in this browser. Please download the PDF instead.",
          variant: "destructive",
        })
        setIsSharingPDF(false)
        return
      }

      // Fetch additional data from IndexedDB if needed
      let fullCustomer: any = customer
      let store: any = null
      const isIndexedDb = isIndexedDbMode()

      // Fetch customer data if not already loaded
      if (invoice.customer_id && !fullCustomer) {
        if (isIndexedDb) {
          fullCustomer = await db.customers.get(invoice.customer_id)
        }
      }

      // Fetch store data if needed
      if (invoice.store_id) {
        if (isIndexedDb) {
          store = await db.stores.get(invoice.store_id)
        }
      }

      // Get served by name
      const servedBy = await getServedByName(invoice)

      // Get profile/logo if not already loaded
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
          console.warn("[SharePDF] Failed to fetch profile:", err)
        }
      }

      // Prepare PDF data from IndexedDB
      const pdfData = {
        invoiceNumber: invoice.invoice_number || "N/A",
        invoiceDate: invoice.invoice_date || new Date().toISOString(),
        customerName: fullCustomer?.name || "",
        customerEmail: fullCustomer?.email || "",
        customerPhone: fullCustomer?.phone || "",
        customerGSTIN: fullCustomer?.gstin || "",
        businessName: store?.name || storeName || businessProfile?.business_name || "Business",
        businessGSTIN: store?.gstin || businessProfile?.business_gstin || "",
        businessAddress: store?.address || businessProfile?.business_address || "",
        businessPhone: store?.phone || businessProfile?.business_phone || "",
        businessEmail: businessProfile?.business_email || "",
        logoUrl: businessProfile?.logo_url || "",
        servedBy: servedBy,
        items: items.map((item: any) => {
          const quantity = Number(item.quantity) || 0
          const unitPrice = Number(item.unit_price || item.unitPrice) || 0
          const discountPercent = Number(item.discount_percent || item.discountPercent) || 0
          const gstRate = Number(item.gst_rate || item.gstRate) || 0
          const baseAmount = quantity * unitPrice * (1 - discountPercent / 100)
          const gstAmount = (invoice.is_gst_invoice || invoice.isGstInvoice) 
            ? (baseAmount * gstRate) / 100 
            : 0
          const lineTotal = baseAmount + gstAmount
          
          return {
            description: item.description || "",
            quantity: quantity,
            unitPrice: unitPrice,
            discountPercent: discountPercent,
            gstRate: gstRate,
            lineTotal: lineTotal,
            gstAmount: gstAmount,
          }
        }),
        subtotal: Number(invoice.subtotal) || 0,
        cgstAmount: Number(invoice.cgst_amount || invoice.cgstAmount) || 0,
        sgstAmount: Number(invoice.sgst_amount || invoice.sgstAmount) || 0,
        igstAmount: Number(invoice.igst_amount || invoice.igstAmount) || 0,
        totalAmount: Number(invoice.total_amount || invoice.totalAmount) || 0,
        isGstInvoice: invoice.is_gst_invoice || invoice.isGstInvoice || false,
      }

      // Generate PDF from IndexedDB data (mini format for sharing)
      const pdfBlob = await generateMiniInvoicePDF(pdfData)

      // Get invoice number and business name for file naming and sharing
      const invoiceNumber = pdfData.invoiceNumber
      const businessName = pdfData.businessName

      // Create File object
      const file = new File([pdfBlob], `Invoice-${invoiceNumber}.pdf`, {
        type: "application/pdf",
      })

      // Check if file sharing is supported
      if (!navigator.canShare({ files: [file] })) {
        // Fallback: download the PDF
        const url = URL.createObjectURL(pdfBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Invoice-${invoiceNumber}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        toast({
          title: "PDF Downloaded",
          description: "File sharing is not supported. The PDF has been downloaded.",
          duration: 3000,
        })
        setIsSharingPDF(false)
        return
      }

      // Share using Web Share API
      await navigator.share({
        files: [file],
        title: `Invoice ${invoiceNumber}`,
        text: `Invoice ${invoiceNumber} from ${businessName}. View it here: ${window.location.origin}/i/${invoiceId}`,
      })

      toast({
        title: "Shared Successfully",
        description: "Invoice PDF shared successfully",
        duration: 3000,
      })
    } catch (error: any) {
      // User cancelled or error occurred
      if (error.name !== "AbortError") {
        console.error("[SharePDF] Error:", error)
        toast({
          title: "Error",
          description: error.message || "Failed to share PDF. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setIsSharingPDF(false)
    }
  }


  return (
    <div className="mx-auto max-w-5xl space-y-4 md:space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 md:gap-4">
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Invoice {invoice.invoice_number}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Created on {new Date(invoice.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Badge className={statusColors[invoice.status]}>{invoice.status.toUpperCase()}</Badge>
          <Button
            onClick={handleSharePDF}
            disabled={isSharingPDF}
            variant="outline"
            size="sm"
            className="gap-2"
            title="Share PDF using Web Share API"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">{isSharingPDF ? "Sharing..." : "Share PDF"}</span>
          </Button>
          <WhatsAppShareButton
            invoice={{
              id: invoice.id,
              invoice_number: invoice.invoice_number,
              invoice_date: invoice.invoice_date,
              total_amount: invoice.total_amount,
              created_by_employee_id: invoice.created_by_employee_id,
              employee_id: invoice.employee_id,
              user_id: invoice.user_id,
              is_gst_invoice: invoice.is_gst_invoice,
              subtotal: invoice.subtotal,
              cgst_amount: invoice.cgst_amount,
              sgst_amount: invoice.sgst_amount,
              igst_amount: invoice.igst_amount,
            }}
            items={items.map((item: any) => ({
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount_percent: item.discount_percent,
              gst_rate: item.gst_rate,
              line_total: item.line_total,
              gst_amount: item.gst_amount,
            }))}
            storeName={storeName}
            invoiceLink={`${typeof window !== 'undefined' ? window.location.origin : ''}/i/${invoice.id}`}
            customer={customer}
            profile={profile}
          />
          <InvoicePrint
            invoiceId={invoiceId}
            invoiceNumber={invoice.invoice_number}
            invoiceData={{
              ...invoice,
              invoice_items: items,
              customers: customer,
              profile: settings
            }}
          />
          <InvoiceActions
            invoiceId={invoiceId}
            invoiceNumber={invoice.invoice_number}
            invoiceData={{
              ...invoice,
              invoice_items: items,
              customers: customer,
              profile: settings
            }}
          />
        </div>
      </div>

      {/* Invoice Details */}
      <div className="grid gap-4 md:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice Date:</span>
              <span>{new Date(invoice.invoice_date).toLocaleDateString()}</span>
            </div>
            {invoice.due_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date:</span>
                <span>{new Date(invoice.due_date).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span>{invoice.is_gst_invoice ? "GST Invoice" : "Non-GST Invoice"}</span>
            </div>
          </CardContent>
        </Card>

        {customer && (
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span>{customer.name}</span>
              </div>
              {customer.email && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{customer.email}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.gstin && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GSTIN:</span>
                  <span>{customer.gstin}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <div className="inline-block min-w-full align-middle">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Discount %</TableHead>
                    {invoice.is_gst_invoice && <TableHead>GST %</TableHead>}
                    {invoice.is_gst_invoice && <TableHead>GST Amount</TableHead>}
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate block max-w-[130px] cursor-help">
                              ₹{item.unit_price.toFixed(2)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Unit Price: ₹{item.unit_price.toFixed(2)}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{item.discount_percent}%</TableCell>
                      {invoice.is_gst_invoice && <TableCell>{item.gst_rate}%</TableCell>}
                      {invoice.is_gst_invoice && (
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block max-w-[130px] cursor-help">
                                ₹{item.gst_amount.toFixed(2)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>GST Amount: ₹{item.gst_amount.toFixed(2)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      )}
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate block max-w-[130px] cursor-help">
                              ₹{item.line_total.toFixed(2)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Line Total: ₹{item.line_total.toFixed(2)}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="ml-auto w-full sm:max-w-sm space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">₹{invoice.subtotal.toFixed(2)}</span>
            </div>
            {invoice.is_gst_invoice && (
              <>
                {invoice.cgst_amount > 0 && (
                  <div className="flex justify-between">
                    <span>CGST:</span>
                    <span className="font-medium">₹{invoice.cgst_amount.toFixed(2)}</span>
                  </div>
                )}
                {invoice.sgst_amount > 0 && (
                  <div className="flex justify-between">
                    <span>SGST:</span>
                    <span className="font-medium">₹{invoice.sgst_amount.toFixed(2)}</span>
                  </div>
                )}
                {invoice.igst_amount > 0 && (
                  <div className="flex justify-between">
                    <span>IGST:</span>
                    <span className="font-medium">₹{invoice.igst_amount.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between border-t pt-2 text-lg font-bold">
              <span>Total:</span>
              <span>₹{invoice.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes and Terms */}
      {(invoice.notes || invoice.terms) && (
        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}
          {invoice.terms && (
            <Card>
              <CardHeader>
                <CardTitle>Terms & Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{invoice.terms}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
