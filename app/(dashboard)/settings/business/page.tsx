"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export default function BusinessSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [businessData, setBusinessData] = useState({
    business_name: "",
    business_gstin: "",
    business_phone: "",
    business_address: "",
  })
  const [invoiceSettings, setInvoiceSettings] = useState({
    invoice_prefix: "INV",
    next_invoice_number: 1,
    default_due_days: 30,
    default_gst_rate: 18,
  })
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchBusinessData()
  }, [])

  const fetchBusinessData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from("user_profiles").select("*").eq("id", user.id).single()

      if (profile) {
        setBusinessData({
          business_name: profile.business_name || "",
          business_gstin: profile.business_gstin || "",
          business_phone: profile.business_phone || "",
          business_address: profile.business_address || "",
        })
      }

      const { data: settings } = await supabase.from("business_settings").select("*").eq("user_id", user.id).single()

      if (settings) {
        setInvoiceSettings({
          invoice_prefix: settings.invoice_prefix || "INV",
          next_invoice_number: settings.next_invoice_number || 1,
          default_due_days: settings.default_due_days || 30,
          default_gst_rate: settings.default_gst_rate || 18,
        })
      }
    } catch (error) {
      console.error("Error fetching business data:", error)
    }
  }

  const handleBusinessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setBusinessData((prev) => ({ ...prev, [name]: value }))
  }

  const handleInvoiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setInvoiceSettings((prev) => ({
      ...prev,
      [name]: name === "next_invoice_number" || name === "default_due_days" ? Number.parseInt(value) : value,
    }))
  }

  const saveBusinessSettings = async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from("user_profiles").update(businessData).eq("id", user.id)

      if (error) throw error
      toast({ title: "Success", description: "Business settings updated" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to update settings", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const saveInvoiceSettings = async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from("business_settings").update(invoiceSettings).eq("user_id", user.id)

      if (error) throw error
      toast({ title: "Success", description: "Invoice settings updated" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to update settings", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Business Settings</h1>
        <p className="text-muted-foreground">Configure your business information and invoice defaults</p>
      </div>

      {/* Business Information */}
      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="business_name">Business Name</Label>
            <Input
              id="business_name"
              name="business_name"
              value={businessData.business_name}
              onChange={handleBusinessChange}
              placeholder="Your business name"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="business_gstin">GSTIN</Label>
            <Input
              id="business_gstin"
              name="business_gstin"
              value={businessData.business_gstin}
              onChange={handleBusinessChange}
              placeholder="27AABCT1234H1Z0"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="business_phone">Phone Number</Label>
            <Input
              id="business_phone"
              name="business_phone"
              value={businessData.business_phone}
              onChange={handleBusinessChange}
              placeholder="+91 9876543210"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="business_address">Business Address</Label>
            <Input
              id="business_address"
              name="business_address"
              value={businessData.business_address}
              onChange={handleBusinessChange}
              placeholder="123 Business Street, City, State"
              className="mt-1"
            />
          </div>

          <Button onClick={saveBusinessSettings} disabled={loading} className="w-full">
            {loading ? "Saving..." : "Save Business Information"}
          </Button>
        </CardContent>
      </Card>

      {/* Invoice Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="invoice_prefix">Invoice Prefix</Label>
              <Input
                id="invoice_prefix"
                name="invoice_prefix"
                value={invoiceSettings.invoice_prefix}
                onChange={handleInvoiceChange}
                placeholder="INV"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="next_invoice_number">Next Invoice Number</Label>
              <Input
                id="next_invoice_number"
                name="next_invoice_number"
                type="number"
                value={invoiceSettings.next_invoice_number}
                onChange={handleInvoiceChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="default_due_days">Default Due Days</Label>
              <Input
                id="default_due_days"
                name="default_due_days"
                type="number"
                value={invoiceSettings.default_due_days}
                onChange={handleInvoiceChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="default_gst_rate">Default GST Rate (%)</Label>
              <Input
                id="default_gst_rate"
                name="default_gst_rate"
                type="number"
                step="0.01"
                value={invoiceSettings.default_gst_rate}
                onChange={handleInvoiceChange}
                className="mt-1"
              />
            </div>
          </div>

          <Button onClick={saveInvoiceSettings} disabled={loading} className="w-full">
            {loading ? "Saving..." : "Save Invoice Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
