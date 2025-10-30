import { createClient } from "@/lib/supabase/server"
import { InvoiceForm } from "@/components/features/invoices/invoice-form"

export default async function NewInvoicePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch customers and products for the form
  const { data: customers } = await supabase.from("customers").select("id, name").eq("user_id", user!.id)

  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, gst_rate, hsn_code, unit")
    .eq("user_id", user!.id)
    .eq("is_active", true)

  // Get business settings for invoice number
  const { data: settings } = await supabase.from("business_settings").select("*").eq("user_id", user!.id).single()

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
