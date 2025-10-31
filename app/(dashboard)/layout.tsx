"use client"

import type React from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { StoreProvider } from "@/lib/utils/store-context"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  
  useEffect(() => {
    // Check auth on client side
    const authType = localStorage.getItem("authType")
    if (authType !== "employee") {
      // Check Supabase auth
      createClient().auth.getUser().then(({ data: { user } }) => {
        if (!user) {
          router.push("/auth/login")
        }
      })
    }
  }, [router])

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
