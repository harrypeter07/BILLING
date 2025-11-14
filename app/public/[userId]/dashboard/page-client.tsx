"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

export default function PublicCustomerDashboardClient() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const userId = params.userId as string
  const [profile, setProfile] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [userId])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const supabase = createClient()

      // Fetch user profile (public data only)
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("business_name, business_phone, business_address")
        .eq("id", userId)
        .single()

      if (profileError || !profileData) {
        setError("Profile not found")
        return
      }

      setProfile(profileData)

      // Fetch invoices for this business (public view - only paid/sent invoices)
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["sent", "paid"])
        .order("invoice_date", { ascending: false })

      if (!invoicesError && invoicesData) {
        setInvoices(invoicesData)
      }
    } catch (err: any) {
      console.error("Error fetching data:", err)
      setError(err.message || "Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error || "Profile not found"}</p>
        </div>
      </div>
    )
  }

  const totalSpent = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0
  const totalInvoices = invoices?.length || 0

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl space-y-6 p-4">
        {/* Header */}
        <div className="border-b pb-6">
          <h1 className="text-3xl font-bold">{profile.business_name}</h1>
          <p className="text-muted-foreground">Your Purchase History</p>
          {profile.business_phone && <p className="text-sm text-muted-foreground">Phone: {profile.business_phone}</p>}
          {profile.business_address && (
            <p className="text-sm text-muted-foreground">Address: {profile.business_address}</p>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalInvoices}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Amount Spent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalSpent.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle>Your Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {!invoices || invoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No invoices available</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>
                          {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell>
                          {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell>₹{Number(invoice.total_amount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              invoice.status === "paid"
                                ? "default"
                                : invoice.status === "sent"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {invoice.status?.toUpperCase() || "UNKNOWN"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

