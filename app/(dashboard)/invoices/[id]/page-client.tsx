"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { ArrowLeft, Printer, Copy, Check } from "lucide-react"
import { InvoiceActions } from "@/components/features/invoices/invoice-actions"
import { InvoicePrint } from "@/components/features/invoices/invoice-print"
import { WhatsAppShareButton } from "@/components/features/invoices/whatsapp-share-button"
import { useToast } from "@/hooks/use-toast"
import { generateMiniInvoicePDF } from "@/lib/utils/mini-invoice-pdf"
import { copyPDFToClipboard, downloadPDF } from "@/lib/utils/clipboard-pdf"
import { useClipboardPermission } from "@/hooks/use-clipboard-permission"
import { useInvoice } from "@/lib/hooks/use-cached-data"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { isIndexedDbMode } from "@/lib/utils/db-mode"

export default function InvoiceDetailPageClient() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const invoiceId = params.id as string
  const { data: invoiceData, isLoading: loading, error } = useInvoice(invoiceId)
  const [settings, setSettings] = useState<any>(null)
  const [storeName, setStoreName] = useState<string>("Business")
  const [isTestingCopy, setIsTestingCopy] = useState(false)
  
  // Request clipboard permission in advance
  const clipboardPermission = useClipboardPermission(true)

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

  // Fetch business settings for printing
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`/api/invoices/${invoiceId}`)
        const data = await response.json()
        if (data.profile) {
          setSettings(data.profile)
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

  // Test PDF copy functionality
  const handleTestPDFCopy = async () => {
    if (!invoice || !items || items.length === 0) {
      toast({
        title: "Error",
        description: "Invoice data not available",
        variant: "destructive",
      })
      return
    }

    setIsTestingCopy(true)

    try {
      // Prepare PDF data (similar to WhatsApp share)
      const pdfData = {
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        customerName: customer?.name || "",
        customerEmail: customer?.email || "",
        customerPhone: customer?.phone || "",
        customerGSTIN: customer?.gstin || "",
        businessName: storeName || "Business",
        businessGSTIN: settings?.business_gstin || "",
        businessAddress: settings?.business_address || "",
        businessPhone: settings?.business_phone || "",
        items: items.map((item: any) => {
          const lineTotal = (item.quantity || 0) * (item.unit_price || 0)
          const gstAmount = invoice.is_gst_invoice
            ? (lineTotal * (item.gst_rate || 0)) / 100
            : 0
          return {
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            discountPercent: item.discount_percent || 0,
            gstRate: item.gst_rate || 0,
            lineTotal: lineTotal + gstAmount,
            gstAmount: gstAmount,
          }
        }),
        subtotal: invoice.subtotal || 0,
        cgstAmount: invoice.cgst_amount || 0,
        sgstAmount: invoice.sgst_amount || 0,
        igstAmount: invoice.igst_amount || 0,
        totalAmount: invoice.total_amount || 0,
        isGstInvoice: invoice.is_gst_invoice || false,
      }

      // Generate PDF
      const pdfBlob = await generateMiniInvoicePDF(pdfData)
      const fileName = `Invoice-${invoice.invoice_number}.pdf`

      // Try to copy to clipboard with comprehensive error handling
      // This will automatically request permission if needed
      const clipboardResult = await copyPDFToClipboard(pdfBlob)

      // Always download as well (as backup)
      downloadPDF(pdfBlob, fileName)

      // Show appropriate success/error message
      if (clipboardResult.success) {
        toast({
          title: "✅ PDF Copied Successfully!",
          description: `PDF has been copied to clipboard and downloaded. You can paste it (Ctrl+V) anywhere.`,
          duration: 6000,
        })
      } else {
        // Show detailed error message
        const errorDetails = clipboardResult.error || 'Unknown error'
        toast({
          title: "PDF Downloaded",
          description: `PDF downloaded. Clipboard copy failed: ${errorDetails}. Check console for details.`,
          duration: 7000,
          variant: "default",
        })
      }
    } catch (error) {
      console.error("[TestPDFCopy] Error:", error)
      toast({
        title: "Error",
        description: "Failed to generate or copy PDF. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsTestingCopy(false)
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
            onClick={handleTestPDFCopy}
            disabled={isTestingCopy}
            variant="outline"
            size="sm"
            className="gap-2"
            title="Test PDF copy to clipboard"
          >
            {isTestingCopy ? (
              <>
                <Check className="h-4 w-4" />
                <span className="hidden sm:inline">Testing...</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span className="hidden sm:inline">Test PDF Copy</span>
              </>
            )}
          </Button>
          <WhatsAppShareButton
            invoice={{
              id: invoice.id,
              invoice_number: invoice.invoice_number,
              invoice_date: invoice.invoice_date,
              total_amount: invoice.total_amount,
            }}
            items={items.map((item: any) => ({
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
            }))}
            storeName={storeName}
            invoiceLink={`${typeof window !== 'undefined' ? window.location.origin : ''}/i/${invoice.id}`}
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
                      <TableCell>₹{item.unit_price.toFixed(2)}</TableCell>
                      <TableCell>{item.discount_percent}%</TableCell>
                      {invoice.is_gst_invoice && <TableCell>{item.gst_rate}%</TableCell>}
                      {invoice.is_gst_invoice && <TableCell>₹{item.gst_amount.toFixed(2)}</TableCell>}
                      <TableCell>₹{item.line_total.toFixed(2)}</TableCell>
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
