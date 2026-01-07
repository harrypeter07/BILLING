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
  const [isSwitchingMode, setIsSwitchingMode] = useState(false)

  useEffect(() => {
    setOfflineEnabled(isOfflineLoginEnabled())
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

  const handleSwitchToSupabase = async (enabled: boolean) => {
    if (!enabled) {
      // Switching to Supabase mode
      if (!confirm("Switch to Supabase mode? This will:\n1. Copy all local data to Supabase (one-time migration)\n2. Switch the app to cloud-only mode\n3. Disconnect from IndexedDB\n\nNote: IndexedDB and Supabase are separate plans with separate data storage.\n\nContinue?")) {
        return
      }
    } else {
      // Switching back to IndexedDB mode
      if (!confirm("Switch back to IndexedDB mode? This will disconnect from Supabase and use local storage only.\n\nNote: Data in Supabase will remain but won't be accessible in IndexedDB mode.\n\nContinue?")) {
        return
      }
    }

    setIsSwitchingMode(true)
    try {
      if (!enabled) {
        // Switching TO Supabase mode - copy all data (one-time migration)
        // Copy stores
        const stores = await db.stores.toArray()
        if (stores.length > 0) {
          const { syncStoreToSupabase } = await import("@/lib/utils/supabase-sync")
          for (const store of stores) {
            await syncStoreToSupabase(store)
          }
        }

        // Copy employees (ensure all are in Supabase)
        const { syncAllEmployeesToSupabase } = await import("@/lib/utils/supabase-sync")
        await syncAllEmployeesToSupabase()
        
        // Copy products, customers, invoices
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Copy products
          const products = await db.products.toArray()
          if (products.length > 0) {
            const productsData = products.map(p => ({
              ...p,
              user_id: user.id,
              created_at: p.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }))
            await supabase.from("products").upsert(productsData, { onConflict: "id" })
          }

          // Copy customers
          const customers = await db.customers.toArray()
          if (customers.length > 0) {
            const customersData = customers.map(c => ({
              ...c,
              user_id: user.id,
              created_at: c.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }))
            await supabase.from("customers").upsert(customersData, { onConflict: "id" })
          }

          // Copy invoices and invoice items
          const invoices = await db.invoices.toArray()
          if (invoices.length > 0) {
            const invoicesData = invoices.map(i => ({
              ...i,
              user_id: user.id,
              created_at: i.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }))
            await supabase.from("invoices").upsert(invoicesData, { onConflict: "id" })

            // Copy invoice items
            for (const invoice of invoices) {
              const items = await db.invoice_items.where("invoice_id").equals(invoice.id).toArray()
              if (items.length > 0) {
                await supabase.from("invoice_items").delete().eq("invoice_id", invoice.id)
                await supabase.from("invoice_items").insert(items.map(item => ({
                  ...item,
                  created_at: item.created_at || new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })))
              }
            }
          }
        }

        // Switch to Supabase mode
        localStorage.setItem('databaseType', 'supabase')
        
        toast({
          title: "Switched to Supabase Mode",
          description: "All local data has been copied to Supabase. App is now in cloud-only mode.",
        })
      } else {
        // Switching back to IndexedDB mode
        localStorage.setItem('databaseType', 'indexeddb')
        
        toast({
          title: "Switched to IndexedDB Mode",
          description: "App is now using local storage. Data will be stored locally in IndexedDB.",
        })
      }

      // Reload to apply changes
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error: any) {
      toast({
        title: "Switch Failed",
        description: error.message || "Failed to switch database mode",
        variant: "destructive",
      })
    } finally {
      setIsSwitchingMode(false)
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
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Supabase Mode</p>
                  <p className="text-xs text-muted-foreground">
                    {dbType === 'supabase' 
                      ? 'Cloud-only mode - All data stored in Supabase' 
                      : 'Local mode - Data stored in IndexedDB only (no cloud sync)'}
                  </p>
                </div>
                <Switch
                  checked={dbType === 'supabase'}
                  onCheckedChange={handleSwitchToSupabase}
                  disabled={isSwitchingMode}
                />
              </div>
              
              {dbType !== 'supabase' && (
                <p className="text-xs text-muted-foreground">
                  Switching to Supabase mode will copy all local data (stores, employees, products, customers, invoices) to cloud storage and switch to cloud-only mode. IndexedDB and Supabase are separate storage plans.
                </p>
              )}
              
              {dbType === 'supabase' && (
                <p className="text-xs text-muted-foreground">
                  All data is automatically saved to Supabase. Switching to IndexedDB mode will disconnect from cloud storage.
                </p>
              )}
            </div>
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

      </div>
    </div>
  )
}
