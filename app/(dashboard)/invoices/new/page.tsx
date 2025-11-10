"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { InvoiceForm } from "@/components/features/invoices/invoice-form"
import { db } from "@/lib/dexie-client"
import { useStore } from "@/lib/utils/store-context"

export default function NewInvoicePage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState<string>("ADMN")
  const { currentStore } = useStore()
  const router = useRouter()
  
  
  // Check if user is employee - only employees can create invoices
  useEffect(() => {
    const checkAccess = async () => {
      const authType = localStorage.getItem("authType")
      if (authType !== "employee") {
        // Check if admin user
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("role")
            .eq("id", user.id)
            .single()
          const role = profile?.role || "admin"
          // Admin cannot create invoices - redirect to invoices list
          if (role === "admin") {
            router.push("/invoices")
            return
          }
        }
      }
    }
    checkAccess()
  }, [router])
  
  useEffect(() => {
    if (currentStore) {
      setStoreId(currentStore.id)
      // Get employee ID from session (to be set when employee logs in)
      const empSession = localStorage.getItem("employeeSession")
      if (empSession) {
        try {
          const session = JSON.parse(empSession)
          setEmployeeId(session.employeeId || "ADMN")
        } catch {}
      }
    }
  }, [currentStore])

  useEffect(() => {
    (async () => {
      {
        try {
          const [cust, prod, inv] = await Promise.all([
            db.customers.toArray(),
            db.products.toArray(),
            db.invoices.toArray(),
          ])
          setCustomers(cust || [])
          setProducts(prod || [])
          setSettings({
            invoice_prefix: 'INV',
            next_invoice_number: (inv?.length || 0) + 1,
            default_gst_rate: 18,
            place_of_supply: null,
          })
        } catch (e) {
          console.error('[NewInvoice][Dexie] load failed', e)
          setCustomers([])
          setProducts([])
          setSettings({ invoice_prefix: 'INV', next_invoice_number: 1, default_gst_rate: 18, place_of_supply: null })
        }
      }
      // Additionally, try to pull remote datasets when authenticated (optional)
      try {
        const supabase = createClient()
        const authType = localStorage.getItem("authType")
        
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
                  const [{ data: dbCustomers }, { data: dbProducts }, { data: dbSettings }] = await Promise.all([
                    supabase.from('customers').select('id, name').eq('user_id', store.admin_user_id),
                    supabase.from('products').select('id, name, price, gst_rate, hsn_code, unit').eq('user_id', store.admin_user_id).eq('is_active', true),
                    supabase.from('business_settings').select('*').eq('user_id', store.admin_user_id).single(),
                  ])
                  setCustomers(dbCustomers || [])
                  setProducts(dbProducts || [])
                  setSettings(dbSettings || null)
                  return
                }
              }
            } catch (e) {
              console.error('[NewInvoice] Employee session error:', e)
            }
          }
          // If employee but no valid session, set empty
          setCustomers([])
          setProducts([])
          setSettings(null)
          // return (employee flow handled above)
        }
        
        // For admin users (Supabase auth)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { return }
        const [{ data: dbCustomers }, { data: dbProducts }, { data: dbSettings }] = await Promise.all([
          supabase.from('customers').select('id, name').eq('user_id', user.id),
          supabase.from('products').select('id, name, price, gst_rate, hsn_code, unit').eq('user_id', user.id).eq('is_active', true),
          supabase.from('business_settings').select('*').eq('user_id', user.id).single(),
        ])
        if (dbCustomers?.length) setCustomers(dbCustomers)
        if (dbProducts?.length) setProducts(dbProducts)
        if (dbSettings) setSettings(dbSettings)
      } catch {}
    })()
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-4 md:space-y-6 px-4 md:px-6 py-4 md:py-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Create New Invoice</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">Generate a new invoice for your customer</p>
      </div>
      <InvoiceForm 
        customers={customers || []} 
        products={products || []} 
        settings={settings} 
        storeId={storeId} 
        employeeId={employeeId}
        onCustomersUpdate={(updatedCustomers) => {
          setCustomers(updatedCustomers)
        }}
      />
    </div>
  )
}
