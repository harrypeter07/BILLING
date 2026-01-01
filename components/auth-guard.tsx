"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { getAuthSession, clearAuthSession, isSessionExpired } from "@/lib/utils/auth-session"
import { createClient } from "@/lib/supabase/client"
import type { AuthSession } from "@/lib/db/dexie"

interface AuthGuardProps {
  children: React.ReactNode
}

/**
 * AuthGuard component that validates session on app startup and blocks navigation if expired
 * Works completely offline - only checks IndexedDB session
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  // Public routes that don't require authentication
  const publicRoutes = ["/auth/login", "/auth/signup", "/auth/employee-login", "/auth/customer-login", "/license", "/"]
  const isPublicRoute = publicRoutes.includes(pathname || "")

  useEffect(() => {
    const checkAuth = async () => {
      // Allow public routes through
      if (isPublicRoute) {
        setIsChecking(false)
        setIsAuthorized(true)
        return
      }

      try {
        // Check IndexedDB session first (works offline)
        const session = await getAuthSession()

        if (!session || isSessionExpired(session)) {
          console.log("[AuthGuard] No valid session found, redirecting to login")
          await clearAuthSession()
          // Also clear localStorage auth data
          if (typeof window !== "undefined") {
            localStorage.removeItem("authType")
            localStorage.removeItem("employeeSession")
            localStorage.removeItem("offlineAdminSession")
          }
          router.push("/auth/login")
          setIsChecking(false)
          setIsAuthorized(false)
          return
        }

        // Session is valid
        console.log("[AuthGuard] Valid session found, allowing access")
        setIsAuthorized(true)

        // Optional: Try to refresh Supabase session if online (non-blocking)
        if (typeof window !== "undefined" && navigator.onLine) {
          try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
              // Supabase session expired but IndexedDB session is valid
              // This is fine for offline mode - continue with IndexedDB session
              console.log("[AuthGuard] Supabase session expired but IndexedDB session valid - continuing offline")
            }
          } catch (error) {
            // Supabase unavailable - that's fine, we have IndexedDB session
            console.log("[AuthGuard] Supabase unavailable, using IndexedDB session")
          }
        }
      } catch (error) {
        console.error("[AuthGuard] Error checking auth:", error)
        // On error, redirect to login
        await clearAuthSession()
        router.push("/auth/login")
        setIsAuthorized(false)
      } finally {
        setIsChecking(false)
      }
    }

    checkAuth()
  }, [pathname, router, isPublicRoute])

  // Show loading state while checking
  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Only render children if authorized or on public route
  if (!isAuthorized && !isPublicRoute) {
    return null // Will redirect to login
  }

  return <>{children}</>
}

