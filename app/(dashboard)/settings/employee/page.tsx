"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { getB2BModeConfig, canToggleB2B } from "@/lib/utils/b2b-mode"
import { useRouter } from "next/navigation"
import { useUserRole } from "@/lib/hooks/use-user-role"

export default function EmployeeSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [allowB2BMode, setAllowB2BMode] = useState(false)
  const [employeeB2BMode, setEmployeeB2BMode] = useState(false)
  const [themePreference, setThemePreference] = useState<'light' | 'dark'>('light')
  const [profileData, setProfileData] = useState({
    full_name: "",
    email: "",
  })
  const { toast } = useToast()
  const supabase = createClient()
  const router = useRouter()
  const { isAdmin, isEmployee } = useUserRole()

  // Redirect if not employee
  useEffect(() => {
    const authType = localStorage.getItem("authType")
    if (authType !== "employee" && !isEmployee) {
      router.push("/dashboard")
    }
  }, [isEmployee, router])

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setInitialLoading(true)
      
      // Get B2B config (includes admin's allow_b2b_mode)
      const b2bConfig = await getB2BModeConfig()
      setAllowB2BMode(b2bConfig.allowB2BMode)
      setEmployeeB2BMode(b2bConfig.isB2BEnabled)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Check employee session
        const employeeSession = localStorage.getItem("employeeSession")
        if (employeeSession) {
          try {
            const session = JSON.parse(employeeSession)
            setProfileData({
              full_name: session.employeeName || "",
              email: session.employeeEmail || session.employeeId || "",
            })
          } catch (e) {
            console.error("[EmployeeSettings] Error parsing session:", e)
          }
        }
        setInitialLoading(false)
        return
      }

      // Get profile data
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name, employee_b2b_mode, theme_preference")
        .eq("id", user.id)
        .maybeSingle()

      if (profile) {
        setProfileData({
          full_name: profile.full_name || "",
          email: user.email || "",
        })
        setEmployeeB2BMode(profile.employee_b2b_mode || false)
        setThemePreference((profile.theme_preference as 'light' | 'dark') || 'light')
      } else {
        setProfileData({
          full_name: "",
          email: user.email || "",
        })
      }
    } catch (error) {
      console.error("[EmployeeSettings] Error fetching settings:", error)
    } finally {
      setInitialLoading(false)
    }
  }

  const handleB2BToggle = async (checked: boolean) => {
    // Check if admin allows B2B
    const canToggle = await canToggleB2B()
    if (!canToggle) {
      toast({
        title: "B2B Mode Not Allowed",
        description: "Admin has not enabled B2B mode. Please contact your administrator.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setEmployeeB2BMode(checked)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // For employee sessions without Supabase auth, store in localStorage
        const employeeSession = localStorage.getItem("employeeSession")
        if (employeeSession) {
          const session = JSON.parse(employeeSession)
          session.employeeB2BMode = checked
          localStorage.setItem("employeeSession", JSON.stringify(session))
        }
        toast({
          title: checked ? "B2B Mode Enabled" : "B2C Mode Enabled",
          description: "Your billing mode preference has been saved.",
        })
        setLoading(false)
        
        // Trigger storage event to update header
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('storage'))
        }
        return
      }

      // Update in Supabase
      const { error } = await supabase
        .from("user_profiles")
        .update({ employee_b2b_mode: checked })
        .eq("id", user.id)

      if (error) throw error

      toast({
        title: checked ? "B2B Mode Enabled" : "B2C Mode Enabled",
        description: "Your billing mode preference has been saved.",
      })

      // Trigger storage event to update header
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('storage'))
      }
    } catch (error: any) {
      // Revert state on error
      setEmployeeB2BMode(!checked)
      toast({
        title: "Error",
        description: error?.message || "Failed to update B2B mode",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleThemeToggle = async (checked: boolean) => {
    const newTheme = checked ? 'dark' : 'light'
    setLoading(true)
    setThemePreference(newTheme)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // For employee sessions without Supabase auth, skip theme update
        setLoading(false)
        return
      }

      const { error } = await supabase
        .from("user_profiles")
        .update({ theme_preference: newTheme })
        .eq("id", user.id)

      if (error) throw error

      toast({
        title: "Theme Updated",
        description: `Theme changed to ${newTheme} mode.`,
      })

      // Apply theme immediately
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', checked)
      }
    } catch (error: any) {
      // Revert state on error
      setThemePreference(checked ? 'light' : 'dark')
      toast({
        title: "Error",
        description: error?.message || "Failed to update theme",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Employee Settings</h1>
        <p className="text-muted-foreground">Manage your personal preferences and billing mode</p>
      </div>

      {/* Profile Information (Read-only) */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Full Name</Label>
            <p className="text-sm text-muted-foreground mt-1">{profileData.full_name || "N/A"}</p>
          </div>

          <div>
            <Label>Email Address</Label>
            <p className="text-sm text-muted-foreground mt-1">{profileData.email || "N/A"}</p>
          </div>

          <Alert>
            <AlertDescription>
              Profile information is managed by your administrator. Please contact them to update your details.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* B2B / B2C Toggle */}
      {allowB2BMode && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="employee-b2b-toggle">Billing Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Switch between B2B (Business-to-Business) and B2C (Business-to-Consumer) modes.
                  This is your personal preference and does not affect other employees or the admin.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">B2C</span>
                <Switch
                  id="employee-b2b-toggle"
                  checked={employeeB2BMode}
                  onCheckedChange={handleB2BToggle}
                  disabled={loading || !allowB2BMode}
                />
                <span className="text-sm font-medium">B2B</span>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                {employeeB2BMode
                  ? "B2B mode is active. GST compliance and B2B requirements will be enforced for your invoices."
                  : "B2C mode is active. Standard consumer billing mode."}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {!allowB2BMode && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                B2B mode is not enabled by your administrator. You are currently using B2C (Business-to-Consumer) mode.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Theme Preference */}
      <Card>
        <CardHeader>
          <CardTitle>Theme Preference</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="theme-toggle">Theme</Label>
              <p className="text-sm text-muted-foreground">
                Choose between light and dark mode for the application interface.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Light</span>
              <Switch
                id="theme-toggle"
                checked={themePreference === 'dark'}
                onCheckedChange={handleThemeToggle}
                disabled={loading}
              />
              <span className="text-sm font-medium">Dark</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

