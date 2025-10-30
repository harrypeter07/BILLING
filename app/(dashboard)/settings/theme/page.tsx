"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Moon, Sun } from "lucide-react"

export default function ThemeSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchThemePreference()
  }, [])

  const fetchThemePreference = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("theme_preference")
        .eq("id", user.id)
        .single()

      if (profile?.theme_preference) {
        setTheme(profile.theme_preference as "light" | "dark")
        applyTheme(profile.theme_preference)
      }
    } catch (error) {
      console.error("Error fetching theme:", error)
    }
  }

  const applyTheme = (selectedTheme: "light" | "dark") => {
    const html = document.documentElement
    if (selectedTheme === "dark") {
      html.classList.add("dark")
    } else {
      html.classList.remove("dark")
    }
  }

  const saveTheme = async (selectedTheme: "light" | "dark") => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from("user_profiles")
        .update({ theme_preference: selectedTheme })
        .eq("id", user.id)

      if (error) throw error

      setTheme(selectedTheme)
      applyTheme(selectedTheme)
      toast({ title: "Success", description: `Theme changed to ${selectedTheme}` })
    } catch (error) {
      toast({ title: "Error", description: "Failed to update theme", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Appearance Settings</h1>
        <p className="text-muted-foreground">Customize the look and feel of your dashboard</p>
      </div>

      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={() => saveTheme("light")}
              disabled={loading}
              className={`p-4 border-2 rounded-lg transition-all ${
                theme === "light"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <Sun className="h-6 w-6" />
                <div className="text-left">
                  <p className="font-medium">Light</p>
                  <p className="text-sm text-muted-foreground">Bright and clean interface</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => saveTheme("dark")}
              disabled={loading}
              className={`p-4 border-2 rounded-lg transition-all ${
                theme === "dark"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <Moon className="h-6 w-6" />
                <div className="text-left">
                  <p className="font-medium">Dark</p>
                  <p className="text-sm text-muted-foreground">Easy on the eyes</p>
                </div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Color Scheme Info */}
      <Card>
        <CardHeader>
          <CardTitle>Color Scheme</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            The application uses a professional color scheme optimized for business use. Your theme preference is saved
            and will be applied automatically when you log in.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-3 border rounded-lg">
              <div className="h-8 w-full bg-blue-500 rounded mb-2"></div>
              <p className="text-sm font-medium">Primary</p>
              <p className="text-xs text-muted-foreground">#3b82f6</p>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="h-8 w-full bg-green-500 rounded mb-2"></div>
              <p className="text-sm font-medium">Success</p>
              <p className="text-xs text-muted-foreground">#10b981</p>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="h-8 w-full bg-red-500 rounded mb-2"></div>
              <p className="text-sm font-medium">Danger</p>
              <p className="text-xs text-muted-foreground">#ef4444</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
