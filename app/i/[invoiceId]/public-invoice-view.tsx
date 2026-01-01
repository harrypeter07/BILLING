"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface PublicInvoiceViewProps {
  invoice: any
  customer: any
  items: any[]
  store: any
}

export default function PublicInvoiceView({
  invoice,
  customer,
  items,
  store,
}: PublicInvoiceViewProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl mb-2">
                  {invoice.is_gst_invoice ? "Tax Invoice" : "Invoice"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {store?.name || "Business Name"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">#{invoice.invoice_number}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(invoice.invoice_date)}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Customer Info */}
            {customer && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Bill To:</h3>
                  <p className="text-sm">{customer.name}</p>
                  {customer.phone && (
                    <p className="text-xs text-muted-foreground">{customer.phone}</p>
                  )}
                  {customer.email && (
                    <p className="text-xs text-muted-foreground">{customer.email}</p>
                  )}
                </div>
                {store && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">From:</h3>
                    <p className="text-sm">{store.name}</p>
                    {store.address && (
                      <p className="text-xs text-muted-foreground">{store.address}</p>
                    )}
                    {store.phone && (
                      <p className="text-xs text-muted-foreground">{store.phone}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Items Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    {invoice.is_gst_invoice && <TableHead className="text-right">GST</TableHead>}
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const lineTotal = (item.quantity || 0) * (item.unit_price || 0)
                    const gstAmount = invoice.is_gst_invoice
                      ? (lineTotal * (item.gst_rate || 0)) / 100
                      : 0
                    const total = lineTotal + gstAmount

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.description || "Item"}
                        </TableCell>
                        <TableCell className="text-right">{item.quantity || 0}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unit_price || 0)}
                        </TableCell>
                        {invoice.is_gst_invoice && (
                          <TableCell className="text-right">
                            {item.gst_rate || 0}%
                          </TableCell>
                        )}
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(total)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-full md:w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(invoice.subtotal || 0)}</span>
                </div>
                {invoice.is_gst_invoice && (
                  <>
                    {invoice.cgst_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>CGST:</span>
                        <span>{formatCurrency(invoice.cgst_amount || 0)}</span>
                      </div>
                    )}
                    {invoice.sgst_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>SGST:</span>
                        <span>{formatCurrency(invoice.sgst_amount || 0)}</span>
                      </div>
                    )}
                    {invoice.igst_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>IGST:</span>
                        <span>{formatCurrency(invoice.igst_amount || 0)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(invoice.total_amount || 0)}</span>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex justify-end">
              <Badge
                variant={
                  invoice.status === "paid"
                    ? "default"
                    : invoice.status === "sent"
                      ? "secondary"
                      : "outline"
                }
              >
                {invoice.status?.toUpperCase() || "DRAFT"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

