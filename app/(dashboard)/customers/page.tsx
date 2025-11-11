"use client"
import { useState, useRef, useEffect } from "react"
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

  const initializedRef = useRef(false)
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    const isIndexedDb = isIndexedDbMode()
    
    if (isIndexedDb) {
      // Load from Dexie (IndexedDB)
      (async () => {
        try {
          setIsLoading(true)
          const list = await db.customers.toArray()
          console.log('[CustomersPage][Dexie] fetched', list?.length || 0, 'customers')
          setCustomers(list)
        } catch (error) {
          console.error('[CustomersPage][Dexie] load failed:', error)
          toast.error('Failed to load customers')
          setCustomers([])
        } finally {
          setIsLoading(false)
        }
      })()
    } else {
      // Load from Supabase
      const fetchData = async () => {
        setIsLoading(true)
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          setCustomers([])
          setIsLoading(false)
          return
        }
        const { data: dbCustomers } = await supabase
          .from("customers")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
        setCustomers(dbCustomers || [])
        setIsLoading(false)
      }
      fetchData()
    }
  }, [])

  const handleAddMockCustomer = async () => {
    try {
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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          toast.error("Not authenticated")
          return
        }
        const { error } = await supabase.from("customers").insert({
          ...mockCustomer,
          user_id: user.id,
        })
        if (error) throw error
        toast.success(`Mock customer "${mockCustomer.name}" added!`)
        // Refresh data
        const { data: dbCustomers } = await supabase
          .from("customers")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
        setCustomers(dbCustomers || [])
      }
    } catch (error: any) {
      toast.error("Failed to add mock customer: " + (error.message || error.toString()))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage your customer database</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleAddMockCustomer}
            title="Add a mock customer with random data"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Add Mock Customer
          </Button>
          <Button asChild>
            <Link href="/customers/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Link>
          </Button>
        </div>
      </div>
      <CustomersTable customers={customers || []} />
    </div>
  )
}
