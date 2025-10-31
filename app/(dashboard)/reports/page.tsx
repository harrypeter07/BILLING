"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, TrendingUp, Package, Receipt } from "lucide-react"
import { db } from "@/lib/dexie-client"
import { getDatabaseType } from "@/lib/utils/db-mode"

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const isExcel = getDatabaseType() === 'excel'

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        if (isExcel) {
          const [inv, prod] = await Promise.all([
            db.invoices.toArray(),
            db.products.toArray(),
          ])
          setInvoices(inv || [])
          setProducts(prod || [])
        } else {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) { setInvoices([]); setProducts([]); return }
          const [{ data: inv }, { data: prod }] = await Promise.all([
            supabase.from('invoices').select('*').eq('user_id', user.id),
            supabase.from('products').select('*').eq('user_id', user.id),
          ])
          setInvoices(inv || [])
          setProducts(prod || [])
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [isExcel])

  const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0
  const paidRevenue = invoices?.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0
  const totalGST = invoices?.reduce((sum, inv) => sum + Number(inv.cgst_amount || 0) + Number(inv.sgst_amount || 0) + Number(inv.igst_amount || 0), 0) || 0
  const totalProducts = products?.length || 0
  const lowStockCount = products?.filter((p) => (p.stock_quantity ?? Infinity) <= 10).length || 0

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground">View your business performance and insights</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRevenue.toLocaleString("en-IN")}</div>
            <p className="text-xs text-muted-foreground">All invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Paid Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{paidRevenue.toLocaleString("en-IN")}</div>
            <p className="text-xs text-muted-foreground">Collected payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total GST</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalGST.toLocaleString("en-IN")}</div>
            <p className="text-xs text-muted-foreground">Tax collected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inventory</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground">{lowStockCount} low stock items</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {["draft", "sent", "paid", "cancelled"].map((status) => {
                const count = invoices?.filter((inv) => inv.status === status).length || 0
                const amount = invoices?.filter((inv) => inv.status === status).reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0
                return (
                  <div key={status} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium capitalize">{status}</p>
                      <p className="text-sm text-muted-foreground">{count} invoices</p>
                    </div>
                    <p className="font-medium">₹{amount.toLocaleString("en-IN")}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>GST Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">CGST</p>
                  <p className="text-sm text-muted-foreground">Central GST</p>
                </div>
                <p className="font-medium">₹{(invoices?.reduce((sum, inv) => sum + Number(inv.cgst_amount || 0), 0) || 0).toLocaleString("en-IN")}</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">SGST</p>
                  <p className="text-sm text-muted-foreground">State GST</p>
                </div>
                <p className="font-medium">₹{(invoices?.reduce((sum, inv) => sum + Number(inv.sgst_amount || 0), 0) || 0).toLocaleString("en-IN")}</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">IGST</p>
                  <p className="text-sm text-muted-foreground">Integrated GST</p>
                </div>
                <p className="font-medium">₹{(invoices?.reduce((sum, inv) => sum + Number(inv.igst_amount || 0), 0) || 0).toLocaleString("en-IN")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
