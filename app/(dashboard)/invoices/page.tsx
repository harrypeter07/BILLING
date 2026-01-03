"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { InvoicesTable } from "@/components/features/invoices/invoices-table"
import { db } from "@/lib/dexie-client"
import { storageManager } from "@/lib/storage-manager"
import { useUserRole } from "@/lib/hooks/use-user-role"
import { isIndexedDbMode } from "@/lib/utils/db-mode"
import { useInvoices, useInvalidateQueries } from "@/lib/hooks/use-cached-data"

export default function InvoicesPage() {
  const { data: invoices = [], isLoading: loading } = useInvoices()
  const { invalidateInvoices } = useInvalidateQueries()
  const { isAdmin, isEmployee } = useUserRole()

  // Check for pending WhatsApp URL and open it after page loads
  useEffect(() => {
    const pendingUrl = sessionStorage.getItem('pendingWhatsAppUrl')
    if (pendingUrl) {
      // Clear it first to prevent multiple opens
      sessionStorage.removeItem('pendingWhatsAppUrl')
      sessionStorage.removeItem('pendingWhatsAppMessage')
      
      // Open WhatsApp after a short delay to ensure page is loaded
      setTimeout(() => {
        try {
          window.open(pendingUrl, '_blank', 'noopener,noreferrer')
        } catch (error) {
          console.error('[InvoicesPage] Failed to open pending WhatsApp:', error)
        }
      }, 500)
    }
  }, [])

  // Excel import removed

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Invoices</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Create and manage your invoices</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Show button immediately - don't wait for role check to avoid delay */}
          <Button asChild className="text-xs sm:text-sm">
            <Link href="/invoices/new">
              <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Create Invoice</span>
              <span className="sm:hidden">Create</span>
            </Link>
          </Button>
        </div>
      </div>

      <InvoicesTable invoices={invoices || []} />
    </div >
  )
}
