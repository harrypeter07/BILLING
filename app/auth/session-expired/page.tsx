"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, LogIn } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { clearAuthSession } from "@/lib/utils/auth-session"
import { clearOfflineSession } from "@/lib/utils/offline-auth"

export default function SessionExpiredPage() {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    // Auto-logout from Supabase when this page loads
    const performLogout = async () => {
      try {
        setIsLoggingOut(true)
        
        // Clear IndexedDB session
        await clearAuthSession()
        
        // Clear offline session
        clearOfflineSession()
        
        // Clear localStorage
        if (typeof window !== "undefined") {
          localStorage.removeItem("authType")
          localStorage.removeItem("employeeSession")
          localStorage.removeItem("offlineAdminSession")
          localStorage.removeItem("currentStoreId")
        }

        // Logout from Supabase only if online
        if (typeof window !== "undefined" && navigator.onLine) {
          try {
            const supabase = createClient()
            await supabase.auth.signOut()
            console.log("[SessionExpired] Supabase logout successful")
          } catch (error) {
            console.error("[SessionExpired] Supabase logout failed:", error)
            // If logout fails, we'll try again when user clicks "Login Again"
          }
        } else {
          console.log("[SessionExpired] Offline - Supabase logout will be attempted when online")
        }
      } catch (error) {
        console.error("[SessionExpired] Error during logout:", error)
      } finally {
        setIsLoggingOut(false)
      }
    }

    performLogout()

    // Listen for online event to attempt logout when connection is restored
    const handleOnline = async () => {
      console.log("[SessionExpired] Connection restored, attempting Supabase logout")
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
        console.log("[SessionExpired] Supabase logout successful (after coming online)")
      } catch (error) {
        console.error("[SessionExpired] Supabase logout failed after coming online:", error)
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline)
      return () => {
        window.removeEventListener("online", handleOnline)
      }
    }
  }, [])

  const handleLoginAgain = async () => {
    // Ensure we're logged out before redirecting (only if online)
    if (typeof window !== "undefined" && navigator.onLine) {
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
        console.log("[SessionExpired] Supabase logout successful before login")
      } catch (error) {
        console.error("[SessionExpired] Supabase logout failed:", error)
        // Continue anyway - we'll clear local sessions
      }
    }
    
    // Clear all sessions again to be sure
    await clearAuthSession()
    clearOfflineSession()
    if (typeof window !== "undefined") {
      localStorage.removeItem("authType")
      localStorage.removeItem("employeeSession")
      localStorage.removeItem("offlineAdminSession")
      localStorage.removeItem("currentStoreId")
    }
    
    // Redirect to login
    router.push("/auth/login")
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Session Expired</CardTitle>
          <CardDescription className="text-base">
            Your session has expired for security reasons. Please log in again to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-semibold text-foreground">What happened?</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Your session has reached its time limit</li>
              <li>For security, you've been automatically logged out</li>
              <li>All your work has been saved</li>
            </ul>
          </div>

          <Button
            onClick={handleLoginAgain}
            disabled={isLoggingOut}
            className="w-full"
            size="lg"
          >
            {isLoggingOut ? (
              <>
                <LogIn className="mr-2 h-4 w-4 animate-pulse" />
                Logging out...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Login Again
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            You will be redirected to the login page
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

