"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { CustomerForm } from "@/components/features/customers/customer-form"
import { useToast } from "@/hooks/use-toast"
import { useCustomer } from "@/lib/hooks/use-cached-data"

export default function EditCustomerPageClient() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { data: customer, isLoading, error } = useCustomer(params.id as string)

  useEffect(() => {
    if (error) {
      toast({ title: "Error", description: "Customer not found", variant: "destructive" })
      router.push("/customers")
    }
  }, [error, router, toast])

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!customer) {
    return <div className="text-center py-8">Customer not found</div>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Edit Customer</h1>
        <p className="text-muted-foreground">Update customer information</p>
      </div>

      <CustomerForm customer={customer} />
    </div>
  )
}

