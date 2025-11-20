"use client"

import type React from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { StoreProvider } from "@/lib/utils/store-context"
import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getOfflineSession, isOfflineLoginEnabled, saveOfflineSession } from "@/lib/utils/offline-auth"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  
  useEffect(() => {
    const checkAuthAndStore = async () => {
      // Check auth on client side
      const authType = localStorage.getItem("authType")
      if (authType !== "employee") {
        // Check Supabase auth
        const supabase = createClient()
        let user = null
        try {
          const { data } = await supabase.auth.getUser()
          user = data.user
        } catch (error) {
          console.warn("[DashboardLayout] Supabase auth unavailable:", error)
          const offlineSession = getOfflineSession()
          if (offlineSession) {
            console.log("[DashboardLayout] Continuing with offline session")
            return
          }
          if (typeof window !== "undefined" && !navigator.onLine) {
            console.log("[DashboardLayout] Offline detected; skipping redirect")
            return
          }
          router.push("/auth/login")
          return
        }
        if (!user) {
          const offlineSession = getOfflineSession()
          if (offlineSession) {
            console.log("[DashboardLayout] No Supabase user but offline session active")
            return
          }
          if (typeof window !== "undefined" && !navigator.onLine) {
            console.log("[DashboardLayout] Offline without session; keeping user on page")
            return
          }
          router.push("/auth/login")
          return
        }
        
        // For admin users, check if they have a store
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .single()
        const userRole = profile?.role || "admin"
        
          // Only check store for admin users (not employees, they handle it differently)
        if ((userRole === "admin" || !profile) && authType !== "employee") {
          // Check Dexie (local database) FIRST - default storage
          let hasStore = false
          let storeId: string | null = null
          
          try {
            const { db } = await import("@/lib/dexie-client")
            const dexieStores = await db.stores.toArray()
            if (dexieStores && dexieStores.length > 0) {
              hasStore = true
              storeId = dexieStores[0].id
              localStorage.setItem("currentStoreId", storeId)
            }
          } catch (dexieError) {
            console.warn("[DashboardLayout] Error checking Dexie stores:", dexieError)
          }
          
          // Only check Supabase if database type is set to Supabase
          const dbType = typeof window !== 'undefined' ? localStorage.getItem('databaseType') : null
          if (dbType === 'supabase') {
            const { data: supabaseStores } = await supabase
              .from("stores")
              .select("*")
              .eq("admin_user_id", user.id)
              .limit(1)
            
            if (supabaseStores && supabaseStores.length > 0) {
              hasStore = true
              storeId = supabaseStores[0].id
              localStorage.setItem("currentStoreId", storeId)
            }
          }
          
          // Only redirect to store setup if:
          // 1. No store exists in local database (Dexie)
          // 2. Not already on the store setup page or any settings page
          // 3. Not on the dashboard page (allow dashboard to show even without store)
          if (!hasStore) {
            // Allow access to store setup and all settings pages
            if (pathname?.includes("/settings")) {
              // Already on settings page, allow it
              return
            }
            // Only redirect if trying to access other pages (not dashboard, not settings)
            if (pathname !== "/dashboard" && pathname !== "/") {
              router.push("/settings/store")
              return
            }
            // Allow dashboard to show even without store (it can show a message)
          }
          
          // Store exists - ensure currentStoreId is set in localStorage
          if (hasStore && storeId) {
            localStorage.setItem("currentStoreId", storeId)
          }
        }
        if (isOfflineLoginEnabled() && user.email) {
          const storedStoreId = localStorage.getItem("currentStoreId")
          saveOfflineSession({
            email: user.email,
            role: userRole,
            storeId: storedStoreId,
          })
        }
      }
    }
    
    checkAuthAndStore()
  }, [router, pathname])

  return (
    <StoreProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col lg:ml-64">
          <Header />
          <main className="flex-1 overflow-y-auto bg-muted/40 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </StoreProvider>
  )
}
