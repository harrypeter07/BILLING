"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { CustomersTable } from "@/components/features/customers/customers-table"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { storageManager } from "@/lib/storage-manager"
import { isIndexedDbMode } from "@/lib/utils/db-mode"
import { useCustomers, useInvalidateQueries } from "@/lib/hooks/use-cached-data"

export default function CustomersPage() {
  const { data: customers = [], isLoading } = useCustomers()
  const { invalidateCustomers } = useInvalidateQueries()

  // Listen for customer creation events
  useEffect(() => {
    const handleCustomerCreated = () => {
      console.log('[CustomersPage] Customer created event received, refetching customers.')
      invalidateCustomers()
    }

    window.addEventListener('customer:created', handleCustomerCreated)

    return () => {
      window.removeEventListener('customer:created', handleCustomerCreated)
    }
  }, [invalidateCustomers])

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Customers</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your customer database</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild className="text-xs sm:text-sm">
            <Link href="/customers/new">
              <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Add Customer</span>
              <span className="sm:hidden">Add</span>
            </Link>
          </Button>
        </div>
      </div>
      <CustomersTable customers={customers || []} />
    </div>
  )
}
