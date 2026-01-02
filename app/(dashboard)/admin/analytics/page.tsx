"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/dexie-client"
import { useUserRole } from "@/lib/hooks/use-user-role"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Calendar, TrendingUp, Users, Receipt, DollarSign, Package, Filter, Download } from "lucide-react"
import Link from "next/link"

interface AnalyticsData {
  totalRevenue: number
  totalInvoices: number
  averageOrderValue: number
  totalCustomers: number
  paidRevenue: number
  pendingRevenue: number
  totalGST: number
  monthlySales: Array<{ month: string; sales: number; count: number }>
  dailySales: Array<{ date: string; sales: number; count: number }>
  topCustomers: Array<{ id: string; name: string; email: string; phone: string; totalSpent: number; invoiceCount: number }>
  topProducts: Array<{ name: string; revenue: number; quantity: number }>
  invoiceStatus: Array<{ status: string; count: number; revenue: number }>
  gstBreakdown: {
    cgst: number
    sgst: number
    igst: number
    total: number
  }
  recentInvoices: Array<{
    id: string
    invoice_number: string
    invoice_date: string
    total_amount: number
    status: string
    customer_name: string
    customer_email: string
    customer_phone: string
  }>
  customerDetails: Array<{
    id: string
    name: string
    email: string
    phone: string
    totalInvoices: number
    totalSpent: number
    averageOrderValue: number
    lastInvoiceDate: string
  }>
}

type DurationFilter = "today" | "week" | "month" | "year" | "all" | "custom"

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const { toast } = useToast()
  const router = useRouter()
  const { isAdmin, isLoading: roleLoading } = useUserRole()

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.replace("/dashboard")
      return
    }
    if (isAdmin && !roleLoading) {
      fetchAnalytics()
    }
  }, [isAdmin, roleLoading, router, durationFilter, customStartDate, customEndDate])

  const getDateRange = (): { start: Date; end: Date } => {
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    let start = new Date()

    switch (durationFilter) {
      case "today":
        start.setHours(0, 0, 0, 0)
        break
      case "week":
        start.setDate(end.getDate() - 7)
        start.setHours(0, 0, 0, 0)
        break
      case "month":
        start.setMonth(end.getMonth() - 1)
        start.setHours(0, 0, 0, 0)
        break
      case "year":
        start.setFullYear(end.getFullYear() - 1)
        start.setHours(0, 0, 0, 0)
        break
      case "custom":
        if (customStartDate && customEndDate) {
          start = new Date(customStartDate)
          start.setHours(0, 0, 0, 0)
          end.setTime(new Date(customEndDate).getTime())
          end.setHours(23, 59, 59, 999)
        }
        break
      case "all":
      default:
        start = new Date(0) // Beginning of time
        break
    }

    return { start, end }
  }

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true)
      let invoices: any[] = []
      let customers: any[] = []
      let invoiceItems: any[] = []
      const dbType = getDatabaseType()
      const { start, end } = getDateRange()

      if (dbType === 'supabase') {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()

          if (!user) {
            invoices = await db.invoices.toArray()
            customers = await db.customers.toArray()
            invoiceItems = await db.invoice_items.toArray()
          } else {
            const [{ data: invData }, { data: custData }, { data: itemsData }] = await Promise.all([
              supabase.from("invoices").select("*").eq("user_id", user.id),
              supabase.from("customers").select("*").eq("user_id", user.id),
              supabase.from("invoice_items").select("*"),
            ])

            invoices = invData || []
            customers = custData || []
            invoiceItems = itemsData || []
          }
        } catch (error) {
          console.error("[AdminAnalytics] Supabase error, falling back to IndexedDB:", error)
          invoices = await db.invoices.toArray()
          customers = await db.customers.toArray()
          invoiceItems = await db.invoice_items.toArray()
        }
      } else {
        invoices = await db.invoices.toArray()
        customers = await db.customers.toArray()
        invoiceItems = await db.invoice_items.toArray()
      }

      // Filter invoices by date range
      const filteredInvoices = invoices.filter((inv) => {
        const invDate = new Date(inv.invoice_date || inv.created_at || 0)
        return invDate >= start && invDate <= end
      })

      // Calculate metrics
      const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0)
      const totalInvoices = filteredInvoices.length
      const averageOrderValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0
      const totalCustomers = customers.length
      const paidRevenue = filteredInvoices
        .filter((i) => i.status === "paid")
        .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0)
      const pendingRevenue = filteredInvoices
        .filter((i) => i.status !== "paid" && i.status !== "cancelled")
        .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0)
      const totalGST = filteredInvoices.reduce(
        (sum, inv) =>
          sum +
          Number(inv.cgst_amount || 0) +
          Number(inv.sgst_amount || 0) +
          Number(inv.igst_amount || 0),
        0
      )

      // Monthly sales
      const monthlySales = getMonthlySales(filteredInvoices)

      // Daily sales (last 30 days)
      const dailySales = getDailySales(filteredInvoices)

      // Top customers
      const topCustomers = getTopCustomers(filteredInvoices, customers)

      // Top products
      const topProducts = getTopProducts(filteredInvoices, invoiceItems)

      // Invoice status breakdown
      const invoiceStatus = [
        { status: "Draft", count: filteredInvoices.filter((i) => i.status === "draft").length, revenue: filteredInvoices.filter((i) => i.status === "draft").reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) },
        { status: "Sent", count: filteredInvoices.filter((i) => i.status === "sent").length, revenue: filteredInvoices.filter((i) => i.status === "sent").reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) },
        { status: "Paid", count: filteredInvoices.filter((i) => i.status === "paid").length, revenue: filteredInvoices.filter((i) => i.status === "paid").reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) },
        { status: "Cancelled", count: filteredInvoices.filter((i) => i.status === "cancelled").length, revenue: filteredInvoices.filter((i) => i.status === "cancelled").reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) },
      ]

      // GST breakdown
      const gstBreakdown = {
        cgst: filteredInvoices.reduce((sum, inv) => sum + Number(inv.cgst_amount || 0), 0),
        sgst: filteredInvoices.reduce((sum, inv) => sum + Number(inv.sgst_amount || 0), 0),
        igst: filteredInvoices.reduce((sum, inv) => sum + Number(inv.igst_amount || 0), 0),
        total: totalGST,
      }

      // Recent invoices
      const recentInvoices = filteredInvoices
        .sort((a, b) => new Date(b.invoice_date || b.created_at || 0).getTime() - new Date(a.invoice_date || a.created_at || 0).getTime())
        .slice(0, 20)
        .map((inv) => {
          const customer = customers.find((c) => c.id === inv.customer_id)
          return {
            id: inv.id,
            invoice_number: inv.invoice_number || inv.invoiceNumber || "N/A",
            invoice_date: inv.invoice_date || inv.created_at || "",
            total_amount: Number(inv.total_amount || 0),
            status: inv.status || "draft",
            customer_name: customer?.name || "N/A",
            customer_email: customer?.email || "",
            customer_phone: customer?.phone || "",
          }
        })

      // Customer details
      const customerDetails = customers.map((customer) => {
        const customerInvoices = filteredInvoices.filter((inv) => inv.customer_id === customer.id)
        const totalSpent = customerInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0)
        const lastInvoice = customerInvoices.sort(
          (a, b) => new Date(b.invoice_date || b.created_at || 0).getTime() - new Date(a.invoice_date || a.created_at || 0).getTime()
        )[0]

        return {
          id: customer.id,
          name: customer.name || "N/A",
          email: customer.email || "",
          phone: customer.phone || "",
          totalInvoices: customerInvoices.length,
          totalSpent,
          averageOrderValue: customerInvoices.length > 0 ? totalSpent / customerInvoices.length : 0,
          lastInvoiceDate: lastInvoice ? (lastInvoice.invoice_date || lastInvoice.created_at || "") : "",
        }
      }).sort((a, b) => b.totalSpent - a.totalSpent)

      setAnalytics({
        totalRevenue,
        totalInvoices,
        averageOrderValue,
        totalCustomers,
        paidRevenue,
        pendingRevenue,
        totalGST,
        monthlySales,
        dailySales,
        topCustomers,
        topProducts,
        invoiceStatus,
        gstBreakdown,
        recentInvoices,
        customerDetails,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch analytics",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getMonthlySales = (invoices: any[]) => {
    const months: Record<string, { sales: number; count: number }> = {}
    invoices.forEach((inv) => {
      const date = inv.invoice_date || inv.created_at || new Date().toISOString()
      const month = new Date(date).toLocaleString("default", { month: "short", year: "numeric" })
      const amount = Number(inv.total_amount || 0)
      if (!months[month]) {
        months[month] = { sales: 0, count: 0 }
      }
      months[month].sales += amount
      months[month].count += 1
    })
    return Object.entries(months).map(([month, data]) => ({ month, ...data }))
  }

  const getDailySales = (invoices: any[]) => {
    const days: Record<string, { sales: number; count: number }> = {}
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - i)
      return date.toISOString().split("T")[0]
    })

    last30Days.forEach((day) => {
      days[day] = { sales: 0, count: 0 }
    })

    invoices.forEach((inv) => {
      const date = new Date(inv.invoice_date || inv.created_at || new Date()).toISOString().split("T")[0]
      if (days[date]) {
        days[date].sales += Number(inv.total_amount || 0)
        days[date].count += 1
      }
    })

    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date: new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), ...data }))
  }

  const getTopCustomers = (invoices: any[], customers: any[]) => {
    const customerMap = new Map<string, { totalSpent: number; invoiceCount: number; customer: any }>()

    invoices.forEach((inv) => {
      if (inv.customer_id) {
        const existing = customerMap.get(inv.customer_id) || { totalSpent: 0, invoiceCount: 0, customer: null }
        existing.totalSpent += Number(inv.total_amount || 0)
        existing.invoiceCount += 1
        if (!existing.customer) {
          existing.customer = customers.find((c) => c.id === inv.customer_id)
        }
        customerMap.set(inv.customer_id, existing)
      }
    })

    return Array.from(customerMap.values())
      .map(({ totalSpent, invoiceCount, customer }) => ({
        id: customer?.id || "",
        name: customer?.name || "Unknown",
        email: customer?.email || "",
        phone: customer?.phone || "",
        totalSpent,
        invoiceCount,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10)
  }

  const getTopProducts = (invoices: any[], invoiceItems: any[]) => {
    const productMap = new Map<string, { revenue: number; quantity: number }>()

    invoices.forEach((inv) => {
      const items = invoiceItems.filter((item) => item.invoice_id === inv.id)
      items.forEach((item) => {
        const productName = item.description || "Unknown"
        const existing = productMap.get(productName) || { revenue: 0, quantity: 0 }
        existing.revenue += Number(item.line_total || item.unit_price * item.quantity || 0)
        existing.quantity += Number(item.quantity || 0)
        productMap.set(productName, existing)
      })
    })

    return Array.from(productMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading analytics...</div>
  }

  if (!analytics) {
    return <div className="text-center py-8">No data available</div>
  }

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Comprehensive business insights and performance metrics</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={durationFilter} onValueChange={(v) => setDurationFilter(v as DurationFilter)}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {durationFilter === "custom" && (
            <div className="flex gap-2">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-[140px]"
              />
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-[140px]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{analytics.totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">All invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Paid Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">₹{analytics.paidRevenue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Collected payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalInvoices}</div>
            <p className="text-xs text-muted-foreground">Average: ₹{analytics.averageOrderValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Active customers</p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-orange-600">₹{analytics.pendingRevenue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Unpaid invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total GST</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">₹{analytics.totalGST.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">CGST: ₹{analytics.gstBreakdown.cgst.toLocaleString("en-IN", { maximumFractionDigits: 2 })} | SGST: ₹{analytics.gstBreakdown.sgst.toLocaleString("en-IN", { maximumFractionDigits: 2 })} | IGST: ₹{analytics.gstBreakdown.igst.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">₹{analytics.averageOrderValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Per invoice</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="invoices">Recent Invoices</TabsTrigger>
          <TabsTrigger value="products">Top Products</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Monthly sales performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.monthlySales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <RechartsTooltip formatter={(value: any) => `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`} />
                    <Legend />
                    <Line type="monotone" dataKey="sales" stroke="#3b82f6" name="Revenue" />
                    <Line type="monotone" dataKey="count" stroke="#10b981" name="Invoice Count" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Sales (Last 30 Days)</CardTitle>
                <CardDescription>Daily revenue breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.dailySales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <RechartsTooltip formatter={(value: any) => `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`} />
                    <Legend />
                    <Bar dataKey="sales" fill="#3b82f6" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invoice Status</CardTitle>
                <CardDescription>Status distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.invoiceStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ status, count, percent }: any) => (percent > 0.05 ? `${status}: ${count}` : "")}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {analytics.invoiceStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: any, name: any, props: any) => [
                        `${props.payload.status}: ${value} (₹${props.payload.revenue.toLocaleString("en-IN", { maximumFractionDigits: 2 })})`,
                        "Count",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>GST Breakdown</CardTitle>
                <CardDescription>Tax collection summary</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: "CGST", value: analytics.gstBreakdown.cgst },
                    { name: "SGST", value: analytics.gstBreakdown.sgst },
                    { name: "IGST", value: analytics.gstBreakdown.igst },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip formatter={(value: any) => `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`} />
                    <Bar dataKey="value" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Details</CardTitle>
              <CardDescription>Complete customer analytics and spending patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Total Invoices</TableHead>
                      <TableHead>Total Spent</TableHead>
                      <TableHead>Avg Order Value</TableHead>
                      <TableHead>Last Invoice</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.customerDetails.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {customer.email && <div>{customer.email}</div>}
                            {customer.phone && <div className="text-muted-foreground">{customer.phone}</div>}
                          </div>
                        </TableCell>
                        <TableCell>{customer.totalInvoices}</TableCell>
                        <TableCell className="font-semibold">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block max-w-[130px] cursor-help">
                                ₹{customer.totalSpent.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Total Spent: ₹{customer.totalSpent.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block max-w-[130px] cursor-help">
                                ₹{customer.averageOrderValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Average Order Value: ₹{customer.averageOrderValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {customer.lastInvoiceDate ? new Date(customer.lastInvoiceDate).toLocaleDateString("en-IN") : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Customers</CardTitle>
              <CardDescription>Highest spending customers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.topCustomers.slice(0, 5).map((customer, index) => (
                  <div key={customer.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-muted-foreground">{customer.email || customer.phone}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">₹{customer.totalSpent.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
                      <div className="text-sm text-muted-foreground">{customer.invoiceCount} invoices</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Invoices</CardTitle>
              <CardDescription>Latest invoice transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.recentInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{new Date(invoice.invoice_date).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{invoice.customer_name}</div>
                            {invoice.customer_email && <div className="text-sm text-muted-foreground">{invoice.customer_email}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block max-w-[130px] cursor-help">
                                ₹{invoice.total_amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Amount: ₹{invoice.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </TooltipContent>
                          </Tooltip>
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
                          >
                            {invoice.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/invoices/${invoice.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Products</CardTitle>
              <CardDescription>Best performing products by revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Quantity Sold</TableHead>
                      <TableHead>Total Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.topProducts.map((product, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.quantity}</TableCell>
                        <TableCell className="font-semibold">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block max-w-[130px] cursor-help">
                                ₹{product.revenue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Total Revenue: ₹{product.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
