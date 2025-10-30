"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/db/dexie"
import { excelSheetManager } from "@/lib/utils/excel-sync-controller"

interface Product {
  id?: string
  name: string
  description?: string | null
  sku?: string | null
  category?: string | null
  price: number
  cost_price?: number | null
  stock_quantity: number
  unit: string
  hsn_code?: string | null
  gst_rate: number
  is_active: boolean
}

interface ProductFormProps {
  product?: Product
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: product?.name || "",
    description: product?.description || "",
    sku: product?.sku || "",
    category: product?.category || "",
    price: product?.price || 0,
    cost_price: product?.cost_price || 0,
    stock_quantity: product?.stock_quantity || 0,
    unit: product?.unit || "piece",
    hsn_code: product?.hsn_code || "",
    gst_rate: product?.gst_rate || 18,
    is_active: product?.is_active ?? true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Force Excel mode so we always save to Excel if possible
    excelSheetManager.setExcelMode(true);

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    try {
      if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
        const id = product?.id || crypto.randomUUID();
        let excelResult = null;
        try {
          if (product?.id) {
            excelResult = excelSheetManager.update('products', id, { ...formData, id })
          } else {
            excelResult = excelSheetManager.add('products', { ...formData, id })
          }
          if (!excelSheetManager.workbook || !excelSheetManager.workbook.Sheets["Products"]) {
            window.alert("Excel sheet 'Products' was not created or writable. Click 'Check Excel Integrity' or allow pop-up/download.");
            throw new Error("Excel sheet missing after save.")
          }
        } catch (excelError) {
          window.alert(
            'Excel Save Failed: ' +
            (excelError instanceof Error && excelError.message ? excelError.message : JSON.stringify(excelError))
          );
          throw excelError;
        }
        toast({
          title: "Success",
          description: `Product ${product?.id ? "updated" : "created"} in Excel`,
        })
        router.push("/products")
        router.refresh()
        return;
      }

      if (product?.id) {
        // Update existing product
        const { error } = await supabase
          .from("products")
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", product.id)

        if (error) throw error

        toast({
          title: "Success",
          description: "Product updated successfully",
        })
      } else {
        // Create new product
        const { error } = await supabase.from("products").insert({
          ...formData,
          user_id: user.id,
        })

        if (error) throw error

        toast({
          title: "Success",
          description: "Product created successfully",
        })
      }

      router.push("/products")
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save product",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., iPhone 15 Pro"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="e.g., IP15P-256-BLK"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Electronics"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g., piece, kg, liter"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">
                Selling Price (₹) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number.parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost_price">Cost Price (₹)</Label>
              <Input
                id="cost_price"
                type="number"
                step="0.01"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: Number.parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock_quantity">
                Stock Quantity <span className="text-destructive">*</span>
              </Label>
              <Input
                id="stock_quantity"
                type="number"
                required
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: Number.parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gst_rate">GST Rate (%)</Label>
              <Input
                id="gst_rate"
                type="number"
                step="0.01"
                value={formData.gst_rate}
                onChange={(e) => setFormData({ ...formData, gst_rate: Number.parseFloat(e.target.value) || 0 })}
                placeholder="18"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hsn_code">HSN Code</Label>
              <Input
                id="hsn_code"
                value={formData.hsn_code}
                onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                placeholder="e.g., 8517"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Product description..."
              rows={4}
            />
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : product ? "Update Product" : "Create Product"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
