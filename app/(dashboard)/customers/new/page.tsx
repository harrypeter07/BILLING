import { CustomerForm } from "@/components/features/customers/customer-form"

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add New Customer</h1>
        <p className="text-muted-foreground">Add a new customer to your database</p>
      </div>

      <CustomerForm />
    </div>
  )
}
