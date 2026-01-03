import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { generateInvoiceSlipPDF } from "@/lib/utils/invoice-slip-pdf"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const invoiceId = resolvedParams.id

    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID required" }, { status: 400 })
    }

    // Create server-side Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {
              // Ignore cookie setting errors in API routes
            }
          },
        },
      }
    )

    // Fetch invoice data from Supabase
    const [{ data: invoice, error: invoiceError }, { data: items, error: itemsError }] = await Promise.all([
      supabase.from("invoices").select("*").eq("id", invoiceId).single(),
      supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId),
    ])

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    if (itemsError) {
      console.error("[InvoicePDF] Error fetching items:", itemsError)
    }

    // Fetch customer if available
    let customer: any = null
    if (invoice.customer_id) {
      const { data: custData } = await supabase
        .from("customers")
        .select("*")
        .eq("id", invoice.customer_id)
        .single()
      customer = custData
    }

    // Fetch store if available
    let store: any = null
    if (invoice.store_id) {
      const { data: storeData } = await supabase
        .from("stores")
        .select("*")
        .eq("id", invoice.store_id)
        .single()
      store = storeData
    }

    // Fetch business settings (try to get user first)
    let settings: any = null
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single()
      settings = profileData
    }

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Prepare PDF data
    const pdfData = {
      invoiceNumber: invoice.invoice_number || invoice.invoiceNumber || "N/A",
      invoiceDate: invoice.invoice_date || invoice.invoiceDate || new Date().toISOString(),
      customerName: customer?.name || "",
      customerEmail: customer?.email || "",
      customerPhone: customer?.phone || "",
      customerGSTIN: customer?.gstin || "",
      businessName: store?.name || settings?.business_name || "Business",
      businessGSTIN: settings?.business_gstin || "",
      businessAddress: settings?.business_address || "",
      businessPhone: settings?.business_phone || "",
      items: items.map((item: any) => {
        const lineTotal = (item.quantity || 0) * (item.unit_price || item.unitPrice || 0)
        const gstAmount = invoice.is_gst_invoice || invoice.isGstInvoice
          ? (lineTotal * (item.gst_rate || item.gstRate || 0)) / 100
          : 0
        return {
          description: item.description || "",
          quantity: item.quantity || 0,
          unitPrice: item.unit_price || item.unitPrice || 0,
          discountPercent: item.discount_percent || item.discountPercent || 0,
          gstRate: item.gst_rate || item.gstRate || 0,
          lineTotal: lineTotal + gstAmount,
          gstAmount: gstAmount,
        }
      }),
      subtotal: invoice.subtotal || 0,
      cgstAmount: invoice.cgst_amount || invoice.cgstAmount || 0,
      sgstAmount: invoice.sgst_amount || invoice.sgstAmount || 0,
      igstAmount: invoice.igst_amount || invoice.igstAmount || 0,
      totalAmount: invoice.total_amount || invoice.totalAmount || 0,
      isGstInvoice: invoice.is_gst_invoice || invoice.isGstInvoice || false,
    }

    // Generate PDF
    const pdfBlob = await generateInvoiceSlipPDF(pdfData)

    // Convert blob to buffer
    const arrayBuffer = await pdfBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Return PDF with proper headers
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Invoice-${pdfData.invoiceNumber}.pdf"`,
        "Content-Length": buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("[InvoicePDF] Error:", error)
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    )
  }
}

