"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, FileSpreadsheet } from "lucide-react"
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

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Products</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your inventory and product catalog</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExcelImport />
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
