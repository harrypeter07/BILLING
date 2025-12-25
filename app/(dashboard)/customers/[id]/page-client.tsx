"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pencil, Mail, Phone, MapPin, FileText, Receipt } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { useToast } from "@/hooks/use-toast"
import { isIndexedDbMode } from "@/lib/utils/db-mode"
import { useCustomer } from "@/lib/hooks/use-cached-data"

export default function CustomerDetailPageClient() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { data: customer, isLoading, error } = useCustomer(params.id as string)
  const [invoices, setInvoices] = useState<any[]>([])

  useEffect(() => {
    if (customer) {
      fetchInvoices()
    }
  }, [customer])

  useEffect(() => {
    if (error) {
      toast({ title: "Error", description: "Customer not found", variant: "destructive" })
      router.push("/customers")
    }
  }, [error, router, toast])

  // Refetch invoices when invoice is created
  useEffect(() => {
    const handleInvoiceCreated = () => {
      console.log('[CustomerDetail] Invoice created event received, refetching invoices')
      fetchInvoices()
    }
    window.addEventListener('invoice:created', handleInvoiceCreated)
    return () => {
      window.removeEventListener('invoice:created', handleInvoiceCreated)
    }
  }, [params.id])

  const fetchInvoices = async () => {
    try {
      const customerId = params.id as string
      console.log('[CustomerDetail] Fetching invoices for customer:', customerId)

      const isIndexedDb = isIndexedDbMode()

      if (isIndexedDb) {
        // Load from IndexedDB - fetch invoices and their items
        // First, get all invoices to debug
        const allInvoices = await db.invoices?.toArray()
        console.log('[CustomerDetail][IndexedDB] All invoices:', allInvoices?.length || 0)
        console.log('[CustomerDetail][IndexedDB] Sample invoice customer_id:', allInvoices?.[0]?.customer_id)
        console.log('[CustomerDetail][IndexedDB] Looking for customer_id:', customerId)

        const localInvs = await db.invoices?.where("customer_id").equals(customerId).toArray()
        console.log('[CustomerDetail][IndexedDB] Found invoices:', localInvs?.length || 0)

        if (localInvs && localInvs.length > 0) {
          // Fetch invoice items for each invoice
          const invoicesWithItems = await Promise.all(
            localInvs.map(async (inv) => {
              const items = await db.invoice_items?.where("invoice_id").equals(inv.id).toArray()
              return {
                ...inv,
                invoice_items: items || []
              }
            })
          )
          setInvoices(invoicesWithItems.sort((a, b) => {
            const dateA = new Date(a.created_at || a.invoice_date || 0).getTime()
            const dateB = new Date(b.created_at || b.invoice_date || 0).getTime()
            return dateB - dateA
          }))
        } else {
          setInvoices([])
        }
      } else {
        // Load from Supabase - fetch invoices with items
        const supabase = createClient()
        const authType = localStorage.getItem("authType")
        let userId: string | null = null

        if (authType === "employee") {
          const empSession = localStorage.getItem("employeeSession")
          if (empSession) {
            const session = JSON.parse(empSession)
            const storeId = session.storeId
            if (storeId) {
              const { data: store } = await supabase
                .from('stores')
                .select('admin_user_id')
                .eq('id', storeId)
                .single()
              if (store?.admin_user_id) {
                userId = store.admin_user_id
              }
            }
          }
        } else {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) userId = user.id
        }

        if (userId) {
          console.log('[CustomerDetail][Supabase] Fetching invoices for customer:', customerId, 'user:', userId)
          // Fetch invoices with invoice_items
          const { data: invs, error } = await supabase
            .from("invoices")
            .select(`
              *,
              invoice_items (*)
            `)
            .eq("customer_id", customerId)
            .eq("user_id", userId)
            .order("created_at", { ascending: false })

          console.log('[CustomerDetail][Supabase] Query result:', { invs: invs?.length || 0, error })

          if (error) {
            console.error('[CustomerDetail][Supabase] Error fetching invoices:', error)
          }

          if (!error && invs) {
            setInvoices(invs)
          } else {
            setInvoices([])
          }
        } else {
          console.warn('[CustomerDetail][Supabase] No userId found')
          setInvoices([])
        }
      }
    } catch (error) {
      console.error("[CustomerDetail] Failed to fetch invoices:", error)
      setInvoices([])
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!customer) {
    return <div className="text-center py-8">Customer not found</div>
  }

  const totalInvoices = invoices?.length || 0
  const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0
  const paidInvoices = invoices?.filter((inv) => inv.status === "paid").length || 0

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{customer.name}</h1>
          <p className="text-muted-foreground">Customer Details</p>
        </div>
        <Button asChild>
          <Link href={`/customers/${params.id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Customer
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRevenue.toLocaleString("en-IN")}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidInvoices}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.email && (
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{customer.email}</p>
                </div>
              </div>
            )}

            {customer.phone && (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">{customer.phone}</p>
                </div>
              </div>
            )}

            {customer.gstin && (
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">GSTIN</p>
                  <p className="text-sm text-muted-foreground">{customer.gstin}</p>
                </div>
              </div>
            )}

            {customer.billing_address && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Billing Address</p>
                  <p className="text-sm text-muted-foreground">{customer.billing_address}</p>
                </div>
              </div>
            )}

            {customer.shipping_address && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Shipping Address</p>
                  <p className="text-sm text-muted-foreground">{customer.shipping_address}</p>
                </div>
              </div>
            )}

            {customer.notes && (
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Notes</p>
                  <p className="text-sm text-muted-foreground">{customer.notes}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Invoice History ({invoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoices && invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-right">GST</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => {
                      const items = invoice.invoice_items || []
                      const itemsCount = items.length
                      const gstAmount = Number(invoice.cgst_amount || 0) + Number(invoice.sgst_amount || 0) + Number(invoice.igst_amount || 0)
                      return (
                        <TableRow
                          key={invoice.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => router.push(`/invoices/${invoice.id}`)}
                        >
                          <TableCell className="font-medium">{invoice.invoice_number || "N/A"}</TableCell>
                          <TableCell>
                            {invoice.invoice_date
                              ? new Date(invoice.invoice_date).toLocaleDateString()
                              : invoice.created_at
                                ? new Date(invoice.created_at).toLocaleDateString()
                                : "N/A"}
                          </TableCell>
                          <TableCell className="text-right">{itemsCount}</TableCell>
                          <TableCell className="text-right">
                            ₹{Number(invoice.subtotal || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            ₹{gstAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            ₹{Number(invoice.total_amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                invoice.status === "paid"
                                  ? "default"
                                  : invoice.status === "sent"
                                    ? "secondary"
                                    : invoice.status === "cancelled"
                                      ? "destructive"
                                      : "outline"
                              }
                              className="capitalize"
                            >
                              {invoice.status || "draft"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p>No invoices yet</p>
                <Button asChild className="mt-4">
                  <Link href={`/invoices/new?customer=${params.id}`}>Create Invoice</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

