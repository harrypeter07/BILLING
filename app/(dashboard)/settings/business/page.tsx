"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Upload, X, Image as ImageIcon } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function BusinessSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [businessData, setBusinessData] = useState({
    business_name: "",
    business_gstin: "",
    business_phone: "",
    business_email: "",
    business_address: "",
    logo_url: "",
  })
  const [invoiceSettings, setInvoiceSettings] = useState({
    invoice_prefix: "INV",
    next_invoice_number: 1,
    default_due_days: 30,
    default_gst_rate: 18,
    is_b2b_enabled: false,
    place_of_supply: "",
    business_email: "",
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
          business_email: profile.business_email || "",
          business_address: profile.business_address || "",
          logo_url: profile.logo_url || "",
        })
        if (profile.logo_url) {
          setLogoPreview(profile.logo_url)
        }
      }

      const { data: settings } = await supabase.from("business_settings").select("*").eq("user_id", user.id).single()

      if (settings) {
        setInvoiceSettings({
          invoice_prefix: settings.invoice_prefix || "INV",
          next_invoice_number: settings.next_invoice_number || 1,
          default_due_days: settings.default_due_days || 30,
          default_gst_rate: settings.default_gst_rate || 18,
          is_b2b_enabled: settings.is_b2b_enabled || false,
          place_of_supply: settings.place_of_supply || "",
          business_email: settings.business_email || "",
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

  const handleB2BToggle = (checked: boolean) => {
    // Validate B2B requirements before enabling
    if (checked) {
      if (!businessData.business_gstin?.trim()) {
        toast({
          title: "GSTIN Required",
          description: "Please set your business GSTIN before enabling B2B mode",
          variant: "destructive",
        })
        return
      }
      if (!businessData.business_address?.trim()) {
        toast({
          title: "Address Required",
          description: "Please set your business address before enabling B2B mode",
          variant: "destructive",
        })
        return
      }
    }
    setInvoiceSettings((prev) => ({ ...prev, is_b2b_enabled: checked }))
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: "Error", description: "Please upload an image file", variant: "destructive" })
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Error", description: "Image size should be less than 2MB", variant: "destructive" })
      return
    }

    setUploadingLogo(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Convert to base64 for storage (works offline too)
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64String = reader.result as string
        
        // Try to upload to Supabase storage if online
        let logoUrl = base64String // Default to base64
        
        try {
          // Upload to Supabase storage
          const fileExt = file.name.split('.').pop()
          const fileName = `${user.id}/${Date.now()}.${fileExt}`
          
          const { error: uploadError } = await supabase.storage
            .from('logos')
            .upload(fileName, file, { upsert: true })
          
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('logos')
              .getPublicUrl(fileName)
            logoUrl = publicUrl
          }
        } catch (storageError) {
          console.warn("[BusinessSettings] Supabase storage unavailable, using base64:", storageError)
          // Continue with base64
        }

        setBusinessData(prev => ({ ...prev, logo_url: logoUrl }))
        setLogoPreview(logoUrl)
        
        // Save immediately
        const { error } = await supabase.from("user_profiles").update({ logo_url: logoUrl }).eq("id", user.id)
        if (error) throw error
        
        toast({ title: "Success", description: "Logo uploaded successfully" })
      }
      reader.onerror = () => {
        toast({ title: "Error", description: "Failed to read image file", variant: "destructive" })
      }
      reader.readAsDataURL(file)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to upload logo", variant: "destructive" })
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleRemoveLogo = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from("user_profiles").update({ logo_url: null }).eq("id", user.id)
      if (error) throw error

      setBusinessData(prev => ({ ...prev, logo_url: "" }))
      setLogoPreview(null)
      toast({ title: "Success", description: "Logo removed" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove logo", variant: "destructive" })
    }
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
            <Label htmlFor="business_email">Email</Label>
            <Input
              id="business_email"
              name="business_email"
              type="email"
              value={businessData.business_email}
              onChange={handleBusinessChange}
              placeholder="business@example.com"
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

          <div>
            <Label>Business Logo</Label>
            <div className="mt-2 space-y-4">
              {logoPreview && (
                <div className="relative inline-block">
                  <img
                    src={logoPreview}
                    alt="Business Logo"
                    className="h-32 w-32 object-contain border rounded-lg p-2 bg-gray-50"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={handleRemoveLogo}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div>
                <Input
                  id="logo_upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                  className="hidden"
                />
                <Label htmlFor="logo_upload" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingLogo}
                    className="w-full"
                    asChild
                  >
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      {uploadingLogo ? "Uploading..." : logoPreview ? "Change Logo" : "Upload Logo"}
                    </span>
                  </Button>
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload your business logo (max 2MB). Will appear on invoices.
                </p>
              </div>
            </div>
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

      {/* B2B Settings */}
      <Card>
        <CardHeader>
          <CardTitle>B2B Billing Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="b2b-toggle">Enable B2B Billing</Label>
              <p className="text-sm text-muted-foreground">
                Enable B2B mode to enforce GST compliance, HSN codes, and tax calculations for business-to-business transactions
              </p>
            </div>
            <Switch
              id="b2b-toggle"
              checked={invoiceSettings.is_b2b_enabled}
              onCheckedChange={handleB2BToggle}
              disabled={loading || !businessData.business_gstin?.trim() || !businessData.business_address?.trim()}
            />
          </div>

          {invoiceSettings.is_b2b_enabled && (
            <Alert>
              <AlertDescription>
                B2B mode is enabled. GSTIN, HSN codes, and tax compliance will be enforced for all invoices.
              </AlertDescription>
            </Alert>
          )}

          {!businessData.business_gstin?.trim() && (
            <Alert variant="destructive">
              <AlertDescription>
                Business GSTIN is required to enable B2B mode. Please set it in Business Information above.
              </AlertDescription>
            </Alert>
          )}

          {!businessData.business_address?.trim() && (
            <Alert variant="destructive">
              <AlertDescription>
                Business address is required to enable B2B mode. Please set it in Business Information above.
              </AlertDescription>
            </Alert>
          )}

          {invoiceSettings.is_b2b_enabled && (
            <>
              <div>
                <Label htmlFor="place_of_supply">Place of Supply (State Code)</Label>
                <Input
                  id="place_of_supply"
                  name="place_of_supply"
                  value={invoiceSettings.place_of_supply}
                  onChange={handleInvoiceChange}
                  placeholder="e.g., 27 (Maharashtra)"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  State code for tax calculation (CGST/SGST vs IGST)
                </p>
              </div>

              <div>
                <Label htmlFor="business_email">Business Email (for B2B invoices)</Label>
                <Input
                  id="business_email"
                  name="business_email"
                  type="email"
                  value={invoiceSettings.business_email}
                  onChange={handleInvoiceChange}
                  placeholder="business@example.com"
                  className="mt-1"
                />
              </div>
            </>
          )}

          <Button onClick={saveInvoiceSettings} disabled={loading} className="w-full">
            {loading ? "Saving..." : "Save B2B Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
