import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Public API route to fetch invoice data (bypasses RLS using service role)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> | { invoiceId: string } }
) {
  try {
    // Await params if it's a Promise (Next.js 15+)
    const resolvedParams = await Promise.resolve(params)
    const invoiceId = resolvedParams.invoiceId

    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID required" }, { status: 400 })
    }

    // Use service role client to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Fetch invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
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

    return NextResponse.json({
      invoice,
      customer: customerResult.data,
      items: itemsResult.data || [],
      store: storeResult.data,
    })
  } catch (error) {
    console.error("[PublicInvoiceAPI] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


