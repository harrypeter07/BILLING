import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import PublicInvoiceView from "./public-invoice-view"

export async function generateMetadata({ params }: { params: { invoiceId: string } }) {
  return {
    title: `Invoice ${params.invoiceId}`,
    description: "View invoice details",
  }
}

export default async function PublicInvoicePage({ params }: { params: { invoiceId: string } }) {
  const invoiceId = params.invoiceId

  try {
    // Public invoice access - only works with Supabase (IndexedDB is local-only)
    const supabase = createClient()

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single()

    if (invoiceError || !invoice) {
      notFound()
    }

    const customer = invoice.customer_id
      ? await supabase
          .from("customers")
          .select("*")
          .eq("id", invoice.customer_id)
          .single()
          .then(({ data }) => data)
      : null

    const { data: items } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)

    const store = invoice.store_id
      ? await supabase
          .from("stores")
          .select("*")
          .eq("id", invoice.store_id)
          .single()
          .then(({ data }) => data)
      : null

    return (
      <PublicInvoiceView
        invoice={invoice}
        customer={customer}
        items={items || []}
        store={store}
      />
    )
  } catch (error) {
    console.error("[PublicInvoice] Error:", error)
    notFound()
  }
}

