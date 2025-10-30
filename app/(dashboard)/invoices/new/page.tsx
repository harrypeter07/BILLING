"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { excelSheetManager } from "@/lib/utils/excel-sync-controller"
import { InvoiceForm } from "@/components/features/invoices/invoice-form"
import { fetchCustomers } from "@/lib/api/customers"
import { fetchProducts } from "@/lib/api/products"
import { getDatabaseType } from "@/lib/utils/db-mode"

export default function NewInvoicePage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const isExcel = getDatabaseType() === 'excel'

  useEffect(() => {
    (async () => {
      if (isExcel) {
        try {
          const [cust, prod] = await Promise.all([
            fetchCustomers(),
            fetchProducts(),
          ])
          console.log('[NewInvoice][Excel] customers:', cust.length, 'products:', prod.length)
          setCustomers(cust || [])
          setProducts(prod || [])
          setSettings({
            invoice_prefix: 'INV',
            next_invoice_number: (excelSheetManager.getList('invoices')?.length || 0) + 1,
            default_gst_rate: 18,
            place_of_supply: null,
          })
        } catch (e) {
          console.error('[NewInvoice][Excel] API fetch failed, fallback to in-memory lists', e)
          setCustomers(excelSheetManager.getList('customers') || [])
          setProducts(excelSheetManager.getList('products') || [])
          setSettings({
            invoice_prefix: 'INV',
            next_invoice_number: (excelSheetManager.getList('invoices')?.length || 0) + 1,
            default_gst_rate: 18,
            place_of_supply: null,
          })
        }
      } else {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setCustomers([]); setProducts([]); setSettings(null); return }
        const [{ data: dbCustomers }, { data: dbProducts }, { data: dbSettings }] = await Promise.all([
          supabase.from('customers').select('id, name').eq('user_id', user.id),
          supabase.from('products').select('id, name, price, gst_rate, hsn_code, unit').eq('user_id', user.id).eq('is_active', true),
          supabase.from('business_settings').select('*').eq('user_id', user.id).single(),
        ])
        console.log('[NewInvoice][Supabase] customers:', dbCustomers?.length || 0, 'products:', dbProducts?.length || 0)
        setCustomers(dbCustomers || [])
        setProducts(dbProducts || [])
        setSettings(dbSettings || null)
      }
    })()
  }, [isExcel])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create New Invoice</h1>
        <p className="text-muted-foreground">Generate a new invoice for your customer</p>
      </div>
      <InvoiceForm customers={customers || []} products={products || []} settings={settings} />
    </div>
  )
}
