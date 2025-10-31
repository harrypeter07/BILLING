"use client"

import type React from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { StoreProvider } from "@/lib/utils/store-context"
import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
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
          const { data: stores } = await supabase
            .from("stores")
            .select("*")
            .eq("admin_user_id", user.id)
            .limit(1)
          
          // If no store exists and not already on store page, redirect to store setup
          if ((!stores || stores.length === 0) && !pathname?.includes("/settings/store")) {
            router.push("/settings/store")
          } else if (stores && stores.length > 0) {
            // Store exists, save to localStorage
            const store = stores[0]
            localStorage.setItem("currentStoreId", store.id)
          }
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
          <main className="flex-1 overflow-y-auto bg-muted/40 p-6">{children}</main>
        </div>
      </div>
    </StoreProvider>
  )
}
