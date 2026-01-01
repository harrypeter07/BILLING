import { notFound } from "next/navigation"
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
    // Fetch invoice data from public API route (bypasses RLS)
    // Use relative URL for server-side fetch (works in both dev and production)
    const apiUrl = process.env.NEXT_PUBLIC_BASE_URL 
      ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/public/invoice/${invoiceId}`
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/public/invoice/${invoiceId}`
      : `http://localhost:${process.env.PORT || 3000}/api/public/invoice/${invoiceId}`
    
    const response = await fetch(apiUrl, {
      cache: "no-store", // Always fetch fresh data
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error("[PublicInvoice] API error:", response.status)
      notFound()
    }

    const data = await response.json()

    if (!data.invoice) {
      notFound()
    }

    return (
      <PublicInvoiceView
        invoice={data.invoice}
        customer={data.customer}
        items={data.items || []}
        store={data.store}
      />
    )
  } catch (error) {
    console.error("[PublicInvoice] Error:", error)
    notFound()
  }
}
