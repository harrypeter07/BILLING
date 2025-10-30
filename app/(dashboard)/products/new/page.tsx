import { ProductForm } from "@/components/features/products/product-form"

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add New Product</h1>
        <p className="text-muted-foreground">Add a new product to your inventory</p>
      </div>

      <ProductForm />
    </div>
  )
}
