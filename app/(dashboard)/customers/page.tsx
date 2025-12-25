"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Sparkles } from "lucide-react"
import Link from "next/link"
import { CustomersTable } from "@/components/features/customers/customers-table"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { storageManager } from "@/lib/storage-manager"
import { isIndexedDbMode } from "@/lib/utils/db-mode"

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingMock, setIsAddingMock] = useState(false)

  const fetchCustomers = useCallback(async () => {
    const isIndexedDb = isIndexedDbMode()
    setIsLoading(true)

    if (isIndexedDb) {
      // IndexedDB mode - load from Dexie
      try {
        const list = await db.customers.toArray()
        console.log('[CustomersPage][Dexie] fetched', list?.length || 0, 'customers')
        setCustomers(list || [])
      } catch (error) {
        console.error('[CustomersPage][Dexie] load failed:', error)
        toast.error('Failed to load customers')
        setCustomers([])
      } finally {
        setIsLoading(false)
      }
    } else {
      // Supabase mode - load from Supabase
      try {
        const supabase = createClient()
        const authType = localStorage.getItem("authType")
        let userId: string | null = null

        // For employees, get admin_user_id from store
        if (authType === "employee") {
          const empSession = localStorage.getItem("employeeSession")
          if (empSession) {
            try {
              const session = JSON.parse(empSession)
              const storeId = session.storeId

              if (storeId) {
                // Get store to find admin_user_id
                const { data: store } = await supabase
                  .from('stores')
                  .select('admin_user_id')
                  .eq('id', storeId)
                  .single()

                if (store?.admin_user_id) {
                  userId = store.admin_user_id
                } else {
                  console.warn('[CustomersPage] Store not found or invalid for employee')
                  setCustomers([])
                  setIsLoading(false)
                  return
                }
              } else {
                console.warn('[CustomersPage] No storeId in employee session')
                setCustomers([])
                setIsLoading(false)
                return
              }
            } catch (e: any) {
              console.error('[CustomersPage] Employee session error:', e)
              setCustomers([])
              setIsLoading(false)
              return
            }
          } else {
            console.warn('[CustomersPage] Employee session not found')
            setCustomers([])
            setIsLoading(false)
            return
          }
        } else {
          // For admin users
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (!user) {
            setCustomers([])
            setIsLoading(false)
            return
          }
          userId = user.id
        }

        if (!userId) {
          setCustomers([])
          setIsLoading(false)
          return
        }

        // Fetch customers for the determined user_id
        const { data: dbCustomers, error } = await supabase
          .from("customers")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })

        if (error) {
          console.error('[CustomersPage][Supabase] Query error:', error)
          throw error
        }

        console.log('[CustomersPage][Supabase] fetched', dbCustomers?.length || 0, 'customers')
        setCustomers(dbCustomers || [])
      } catch (error) {
        console.error('[CustomersPage][Supabase] load failed:', error)
        toast.error('Failed to load customers')
        setCustomers([])
      } finally {
        setIsLoading(false)
      }
    }
  }, [])

  const initializedRef = useRef(false)
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    fetchCustomers()
  }, [fetchCustomers])

  // Listen for customer creation events
  useEffect(() => {
    const handleCustomerCreated = () => {
      console.log('[CustomersPage] Customer created event received, refetching customers.')
      fetchCustomers()
    }

    window.addEventListener('customer:created', handleCustomerCreated)

    return () => {
      window.removeEventListener('customer:created', handleCustomerCreated)
    }
  }, [fetchCustomers])

  const handleAddMockCustomer = async () => {
    try {
      setIsAddingMock(true)
      const rand = Math.floor(Math.random() * 10000)
      const isIndexedDb = isIndexedDbMode()

      const mockCustomer = {
        id: crypto.randomUUID(),
        name: `Mock Customer ${rand}`,
        email: `user${rand}@example.com`,
        phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
        gstin: `29${Math.floor(1000000000 + Math.random() * 8999999999)}${Math.floor(10 + Math.random() * 90)}`,
        billing_address: `${rand} Street, Sector ${Math.floor(1 + Math.random() * 50)}, City`,
        shipping_address: `${rand + 1} Street, Sector ${Math.floor(1 + Math.random() * 50)}, City`,
        notes: `Mock customer generated at ${new Date().toLocaleString()}`,
      }

      if (isIndexedDb) {
        // Save to Dexie
        await storageManager.addCustomer(mockCustomer as any)
        const list = await db.customers.toArray()
        setCustomers(list)
        toast.success(`Mock customer "${mockCustomer.name}" added!`)
      } else {
        // Save to Supabase
        const supabase = createClient()
        const authType = localStorage.getItem("authType")
        let userId: string | null = null

        // For employees, get admin_user_id from store
        if (authType === "employee") {
          const empSession = localStorage.getItem("employeeSession")
          if (empSession) {
            try {
              const session = JSON.parse(empSession)
              const storeId = session.storeId

              if (storeId) {
                const { data: store } = await supabase
                  .from('stores')
                  .select('admin_user_id')
                  .eq('id', storeId)
                  .single()

                if (store?.admin_user_id) {
                  userId = store.admin_user_id
                } else {
                  toast.error("Store not found")
                  return
                }
              } else {
                toast.error("No store assigned")
                return
              }
            } catch (e: any) {
              toast.error("Failed to get employee store: " + (e.message || "Unknown error"))
              return
            }
          } else {
            toast.error("Employee session not found")
            return
          }
        } else {
          // For admin users
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            toast.error("Not authenticated")
            return
          }
          userId = user.id
        }

        if (!userId) {
          toast.error("Unable to determine user ID")
          return
        }

        const { error } = await supabase.from("customers").insert({
          ...mockCustomer,
          user_id: userId,
        })
        if (error) throw error
        toast.success(`Mock customer "${mockCustomer.name}" added!`)
        // Refresh data using fetchCustomers
        await fetchCustomers()
      }
    } catch (error: any) {
      toast.error("Failed to add mock customer: " + (error.message || error.toString()))
    } finally {
      setIsAddingMock(false)
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Customers</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your customer database</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleAddMockCustomer}
            disabled={isAddingMock}
            title="Add a mock customer with random data"
            className="text-xs sm:text-sm"
          >
            {isAddingMock ? (
              <>
                <div className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span className="hidden sm:inline">Adding...</span>
                <span className="sm:hidden">...</span>
              </>
            ) : (
              <>
                <Sparkles className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Add Mock Customer</span>
                <span className="sm:hidden">Mock</span>
              </>
            )}
          </Button>
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
