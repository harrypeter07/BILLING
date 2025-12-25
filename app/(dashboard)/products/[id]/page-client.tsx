"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ProductForm } from "@/components/features/products/product-form"
import { useToast } from "@/hooks/use-toast"
import { useProduct } from "@/lib/hooks/use-cached-data"

export default function EditProductPageClient() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const productId = params.id as string
  const { data: product, isLoading: loading, error } = useProduct(productId)

  useEffect(() => {
    if (error) {
      toast({ title: "Error", description: "Product not found", variant: "destructive" })
      router.push("/products")
    }
  }, [error, router, toast])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Edit Product</h1>
          <p className="text-muted-foreground">Loading product information...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return null
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Product</h1>
        <p className="text-muted-foreground">Update product information</p>
      </div>

      <ProductForm product={product} />
    </div>
  )
}

