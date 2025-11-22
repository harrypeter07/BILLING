"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Building2, User, Palette, Store, Cloud, Database, Shield, LogOut } from "lucide-react"
import { db } from "@/lib/dexie-client"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { useStore } from "@/lib/utils/store-context"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"
import { isOfflineLoginEnabled, setOfflineLoginEnabled } from "@/lib/utils/offline-auth"
import { clearLicense, getStoredLicense } from "@/lib/utils/license-manager"

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const { currentStore } = useStore()
  const router = useRouter()
  const { toast } = useToast()
  const isExcel = false
  const dbType = getDatabaseType()
  const [offlineEnabled, setOfflineEnabled] = useState(false)
  const [licenseInfo, setLicenseInfo] = useState<any>(null)
  const [clearingLicense, setClearingLicense] = useState(false)

  useEffect(() => {
    setOfflineEnabled(isOfflineLoginEnabled())
  }, [])

  useEffect(() => {
    const fetchLicenseInfo = async () => {
      try {
        const license = await getStoredLicense()
        setLicenseInfo(license)
      } catch (error) {
        console.error("Error fetching license info:", error)
      }
    }
    fetchLicenseInfo()
  }, [])

  // Only admin can access settings
  useEffect(() => {
    const checkAccess = async () => {
      const authType = localStorage.getItem("authType")
      if (authType === "employee") {
        router.push("/dashboard")
        return
      }
      const supabase = createClient()
      const { data: { user: u } } = await supabase.auth.getUser()
      if (u) {
        const { data: p } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", u.id)
          .single()
        const role = p?.role || "admin"
        if (role !== "admin") {
          router.push("/dashboard")
        }
      }
    }
    checkAccess()
  }, [router])

  useEffect(() => {
    (async () => {
      if (isExcel) {
        // Excel mode - load profile/settings from localStorage or default
        // Try to get user profile data from Supabase if available
        const supabase = createClient()
        const { data: { user: u } } = await supabase.auth.getUser()
        setUser(u)
        if (u) {
          try {
            const { data: p } = await supabase.from("user_profiles").select("*").eq("id", u.id).single()
            const { data: s } = await supabase.from("business_settings").select("*").eq("user_id", u.id).single()
            setProfile(p)
            setSettings(s)
          } catch (e) {
            // If no profile exists yet, set defaults
            setProfile(null)
            setSettings(null)
          }
        }
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

  const handleSyncAllToSupabase = async () => {
    setIsSyncing(true)
    try {
      // Sync stores first
      const stores = await db.stores.toArray()
      if (stores.length > 0) {
        const { syncStoreToSupabase } = await import("@/lib/utils/supabase-sync")
        for (const store of stores) {
          await syncStoreToSupabase(store)
        }
      }

      // Sync employees
      const { syncAllEmployeesToSupabase } = await import("@/lib/utils/supabase-sync")
      const employeeResult = await syncAllEmployeesToSupabase()
      
      // Sync products, customers, invoices via sync manager
      const { syncManager } = await import("@/lib/sync/sync-manager")
      await syncManager.syncAll()

      toast({
        title: "Sync Complete",
        description: `Synced ${stores.length} stores, ${employeeResult.synced} employees, and all other data to Supabase`,
      })
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync data to Supabase",
        variant: "destructive",
      })
    } finally {
      setIsSyncing(false)
    }
  }

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

        {/* Excel connector removed - IndexedDB is the primary local storage */}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              <CardTitle>Store Settings</CardTitle>
            </div>
            <CardDescription>{currentStore ? "Manage your store information" : "Create your store to get started"}</CardDescription>
          </CardHeader>
          <CardContent>
            {currentStore ? (
              <div className="space-y-2 text-sm mb-4">
                <div>
                  <p className="font-medium">Store Name</p>
                  <p className="text-muted-foreground">{currentStore.name || "Not set"}</p>
                </div>
                <div>
                  <p className="font-medium">Store Code</p>
                  <p className="text-muted-foreground font-mono">{currentStore.store_code || "Not set"}</p>
                </div>
                {currentStore.address && (
                  <div>
                    <p className="font-medium">Address</p>
                    <p className="text-muted-foreground">{currentStore.address}</p>
                  </div>
                )}
                {currentStore.gstin && (
                  <div>
                    <p className="font-medium">GSTIN</p>
                    <p className="text-muted-foreground">{currentStore.gstin}</p>
                  </div>
                )}
                {currentStore.phone && (
                  <div>
                    <p className="font-medium">Phone</p>
                    <p className="text-muted-foreground">{currentStore.phone}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">No store created yet. Create your first store to start managing your business.</p>
            )}
            <Button asChild className="w-full bg-transparent" variant="outline">
              <Link href="/settings/store">{currentStore ? "Manage Store" : "Create Store"}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Database & Sync</CardTitle>
            </div>
            <CardDescription>
              {dbType === 'supabase' 
                ? "Currently using Supabase cloud storage" 
                : "Currently using local storage (IndexedDB)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm mb-4">
              <div>
                <p className="font-medium">Current Database</p>
                <p className="text-muted-foreground">{dbType === 'supabase' ? 'Supabase (Cloud)' : 'Local (IndexedDB)'}</p>
              </div>
              <div>
                <p className="font-medium">Storage Location</p>
                <p className="text-muted-foreground">
                  {dbType === 'supabase' 
                    ? 'Data stored in Supabase cloud' 
                    : 'Data stored locally in browser'}
                </p>
              </div>
            </div>
            {dbType !== 'supabase' && (
              <div className="space-y-2">
                <Button 
                  onClick={handleSyncAllToSupabase}
                  disabled={isSyncing}
                  className="w-full"
                  variant="outline"
                >
                  <Cloud className="h-4 w-4 mr-2" />
                  {isSyncing ? "Syncing..." : "Sync All Data to Supabase"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Sync all current local data (stores, employees, products, customers, invoices) to Supabase cloud storage
                </p>
              </div>
            )}
            {dbType === 'supabase' && (
              <p className="text-xs text-muted-foreground">
                All data is automatically saved to Supabase. No sync needed.
              </p>
            )}
            <div className="mt-6 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Offline admin login</p>
                  <p className="text-xs text-muted-foreground">
                    Store a hashed password locally so you can sign in without internet. Turn off to remove saved secrets.
                  </p>
                </div>
                <Switch
                  checked={offlineEnabled}
                  onCheckedChange={(checked) => {
                    setOfflineEnabled(checked)
                    setOfflineLoginEnabled(checked)
                    toast({
                      title: checked ? "Offline login enabled" : "Offline login disabled",
                      description: checked
                        ? "Your next successful login will refresh the offline credential."
                        : "All offline credentials were cleared.",
                    })
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>License Management</CardTitle>
            </div>
            <CardDescription>Manage your license key activation</CardDescription>
          </CardHeader>
          <CardContent>
            {licenseInfo ? (
              <div className="space-y-2 text-sm mb-4">
                <div>
                  <p className="font-medium">Client Name</p>
                  <p className="text-muted-foreground">{licenseInfo.clientName || "Not set"}</p>
                </div>
                <div>
                  <p className="font-medium">License Key</p>
                  <p className="text-muted-foreground font-mono text-xs">{licenseInfo.licenseKey || "Not set"}</p>
                </div>
                <div>
                  <p className="font-medium">Device ID (MAC)</p>
                  <p className="text-muted-foreground font-mono text-xs">{licenseInfo.macAddress || "Not set"}</p>
                </div>
                <div>
                  <p className="font-medium">Status</p>
                  <p className="text-muted-foreground capitalize">{licenseInfo.status || "Unknown"}</p>
                </div>
                <div>
                  <p className="font-medium">Expires On</p>
                  <p className="text-muted-foreground">
                    {licenseInfo.expiresOn ? new Date(licenseInfo.expiresOn).toLocaleDateString() : "Not set"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">No license information found.</p>
            )}
            <Button
              onClick={async () => {
                if (!confirm("Are you sure you want to logout/clear the license? This will require you to activate again.")) {
                  return
                }
                setClearingLicense(true)
                try {
                  const result = await clearLicense()
                  if (result.success) {
                    toast({
                      title: "License cleared",
                      description: "License has been removed. You will need to activate again.",
                    })
                    setLicenseInfo(null)
                    // Redirect to license page
                    setTimeout(() => {
                      router.push("/license")
                    }, 1000)
                  } else {
                    toast({
                      title: "Failed to clear license",
                      description: result.error || "An error occurred",
                      variant: "destructive",
                    })
                  }
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || "An unexpected error occurred",
                    variant: "destructive",
                  })
                } finally {
                  setClearingLicense(false)
                }
              }}
              disabled={clearingLicense || !licenseInfo}
              className="w-full bg-transparent text-destructive hover:text-destructive hover:bg-destructive/10"
              variant="outline"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {clearingLicense ? "Clearing License..." : "Logout License (For Testing)"}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              This will completely remove the license from your computer. Use this for testing purposes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
