"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Building2, User, Palette, FileSpreadsheet } from "lucide-react"
import { ExcelConnector } from "@/components/settings/excel-connector"
import { db } from "@/lib/dexie-client"
import { getDatabaseType } from "@/lib/utils/db-mode"

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const isExcel = getDatabaseType() === 'excel'

  useEffect(() => {
    (async () => {
      if (isExcel) {
        // Excel mode - no profile/settings from Supabase
        setProfile(null)
        setSettings(null)
      } else {
        const supabase = createClient()
        const { data: { user: u } } = await supabase.auth.getUser()
        setUser(u)
        if (u) {
          const [{ data: p }, { data: s }] = await Promise.all([
            supabase.from("user_profiles").select("*").eq("id", u.id).single(),
            supabase.from("business_settings").select("*").eq("user_id", u.id).single(),
          ])
          setProfile(p)
          setSettings(s)
        }
      }
    })()
  }, [isExcel])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and business settings</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>Business Settings</CardTitle>
            </div>
            <CardDescription>Configure your business information and invoice settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <p className="font-medium">Business Name</p>
                <p className="text-muted-foreground">{profile?.business_name || "Not set"}</p>
              </div>
              <div>
                <p className="font-medium">GSTIN</p>
                <p className="text-muted-foreground">{profile?.business_gstin || "Not set"}</p>
              </div>
              <div>
                <p className="font-medium">Invoice Prefix</p>
                <p className="text-muted-foreground">{settings?.invoice_prefix || "INV"}</p>
              </div>
            </div>
            <Button asChild className="mt-4 w-full bg-transparent" variant="outline">
              <Link href="/settings/business">Edit Business Settings</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Profile Settings</CardTitle>
            </div>
            <CardDescription>Update your personal information and account details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <p className="font-medium">Name</p>
                <p className="text-muted-foreground">{profile?.full_name || "Not set"}</p>
              </div>
              <div>
                <p className="font-medium">Email</p>
                <p className="text-muted-foreground">{user?.email || "Not available"}</p>
              </div>
            </div>
            <Button asChild className="mt-4 w-full bg-transparent" variant="outline">
              <Link href="/settings/profile">Edit Profile</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              <CardTitle>Appearance</CardTitle>
            </div>
            <CardDescription>Customize the look and feel of your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-muted-foreground">{profile?.theme_preference || "Light"}</p>
              </div>
            </div>
            <Button asChild className="mt-4 w-full bg-transparent" variant="outline">
              <Link href="/settings/theme">Customize Theme</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              <CardTitle>Excel Connection</CardTitle>
            </div>
            <CardDescription>Connect an external .xlsx file and save in background</CardDescription>
          </CardHeader>
          <CardContent>
            <ExcelConnector />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>Store Settings</CardTitle>
            </div>
            <CardDescription>Create or manage your store information</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-transparent" variant="outline">
              <Link href="/settings/store">Manage Store</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
