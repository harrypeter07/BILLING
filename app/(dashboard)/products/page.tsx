"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, FileSpreadsheet, Sparkles } from "lucide-react"
import Link from "next/link"
import { ProductsTable } from "@/components/features/products/products-table"
import { toast } from "sonner"
// excel-sync-controller removed; Dexie is the source of truth
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { getDatabaseType, isIndexedDbMode } from "@/lib/utils/db-mode"
import { storageManager } from "@/lib/storage-manager"
import { useProducts, useInvalidateQueries } from "@/lib/hooks/use-cached-data"

export default function ProductsPage() {
  const { data: products = [], isLoading } = useProducts()
  const { invalidateProducts } = useInvalidateQueries()
  const [isAddingMock, setIsAddingMock] = useState(false)

  // Listen for product deletion events
  useEffect(() => {
    const handleProductDeleted = () => {
      invalidateProducts()
    }
    window.addEventListener('products:deleted', handleProductDeleted)
    return () => {
      window.removeEventListener('products:deleted', handleProductDeleted)
    }
  }, [invalidateProducts])

  // Excel import logic
  function ExcelImport() {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [importing, setImporting] = useState(false)
    const handleClick = () => inputRef.current?.click()
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.[0]) return
      setImporting(true)
      try {
        const isIndexedDb = isIndexedDbMode()
        if (!isIndexedDb) {
          toast.error("Excel import is only available in IndexedDB mode")
          return
        }

        const { importProductsFromExcel } = await import("@/lib/utils/excel-import")
        const res = await importProductsFromExcel(e.target.files[0])
        if (!res.success) throw new Error(res.errors[0] || "Import failed")
        // Save imported products to Dexie
        const toSave = (res.data || []).map((p: any) => ({ id: crypto.randomUUID(), ...p }))
        for (const p of toSave) {
          await storageManager.addProduct(p as any)
        }
        await invalidateProducts()
        toast.success(`Products imported: ${toSave.length}`)

      } catch (error: any) {
        toast.error("Import failed: " + (error.message || error.toString()))
      } finally {
        setImporting(false)
        if (inputRef.current) inputRef.current.value = ""
      }
    }
    return (
      <>
        <Button type="button" variant="secondary" className="mr-2" onClick={handleClick} disabled={importing}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Import from Excel
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleImport}
          style={{ display: "none" }}
        />
      </>
    )
  }

  const handleAddMockProduct = async () => {
    try {
      setIsAddingMock(true)
      const rand = Math.floor(Math.random() * 10000)
      const isIndexedDb = isIndexedDbMode()

      const product = {
        id: crypto.randomUUID(),
        name: `Mock Product ${rand}`,
        sku: `SKU-${rand}`,
        category: ["General", "Tools", "Food"][rand % 3],
        price: Number((Math.random() * 1000 + 10).toFixed(2)),
        cost_price: Number((Math.random() * 800 + 5).toFixed(2)),
        stock_quantity: Math.floor(Math.random() * 100) + 1,
        unit: "piece",
        hsn_code: "1234",
        gst_rate: 18,
        is_active: true,
      }

      if (isIndexedDb) {
        await storageManager.addProduct(product as any)
        await invalidateProducts()
        toast.success(`Mock product "${product.name}" added!`)
      } else {
        // Supabase
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { toast.error("User not authenticated"); return }
        const { error } = await supabase.from("products").insert({
          ...product,
          user_id: user.id
        })
        if (error) throw error
        await invalidateProducts()
        toast.success(`Mock product "${product.name}" added!`)
      }
    } catch (error: any) {
      toast.error("Failed to add mock product: " + (error.message || error.toString()))
    } finally {
      setIsAddingMock(false)
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Products</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your inventory and product catalog</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExcelImport />
          <Button type="button" variant="outline" onClick={handleAddMockProduct} disabled={isAddingMock} title="Add a mock product" className="text-xs sm:text-sm">
            {isAddingMock ? (
              <>
                <div className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span className="hidden sm:inline">Adding...</span>
                <span className="sm:hidden">...</span>
              </>
            ) : (
              <>
                <Sparkles className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Add Mock Product</span>
                <span className="sm:hidden">Mock</span>
              </>
            )}
          </Button>
          <Button asChild className="text-xs sm:text-sm">
            <Link href="/products/new">
              <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Add Product</span>
              <span className="sm:hidden">Add</span>
            </Link>
          </Button>
        </div>
      </div>
      <ProductsTable products={products || []} />
    </div>
  )
}
