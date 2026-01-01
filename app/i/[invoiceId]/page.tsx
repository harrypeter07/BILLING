import { notFound } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import PublicInvoiceView from "./public-invoice-view"

export async function generateMetadata({ params }: { params: Promise<{ invoiceId: string }> | { invoiceId: string } }) {
  const resolvedParams = await Promise.resolve(params)
  return {
    title: `Invoice ${resolvedParams.invoiceId}`,
    description: "View invoice details",
  }
}

export default async function PublicInvoicePage({ params }: { params: Promise<{ invoiceId: string }> | { invoiceId: string } }) {
  const resolvedParams = await Promise.resolve(params)
  const invoiceId = resolvedParams.invoiceId

  if (!invoiceId) {
    notFound()
  }

  try {
    // Use service role client to bypass RLS (directly in server component)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[PublicInvoice] Missing Supabase configuration")
      notFound()
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Fetch invoice - use maybeSingle() to handle cases where invoice doesn't exist
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle()

    if (invoiceError) {
      console.error("[PublicInvoice] Error fetching invoice:", invoiceError)
      console.error("[PublicInvoice] Invoice ID:", invoiceId)
      notFound()
    }

    if (!invoice) {
      console.error("[PublicInvoice] Invoice not found for ID:", invoiceId)
      notFound()
    }

    // Fetch related data
    const [customerResult, itemsResult, storeResult] = await Promise.all([
      invoice.customer_id
        ? supabase
            .from("customers")
            .select("*")
            .eq("id", invoice.customer_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId),
      invoice.store_id
        ? supabase
            .from("stores")
            .select("*")
            .eq("id", invoice.store_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
    ])

    return (
      <PublicInvoiceView
        invoice={invoice}
        customer={customerResult.data}
        items={itemsResult.data || []}
        store={storeResult.data}
      />
    )
  } catch (error) {
    console.error("[PublicInvoice] Error:", error)
    notFound()
  }
}
