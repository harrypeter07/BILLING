/**
 * Utility to ensure invoice data is available in Supabase for PDF generation
 * If invoice doesn't exist in Supabase, it will be uploaded from IndexedDB
 */
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { isIndexedDbMode } from "./db-mode"

export interface InvoicePDFData {
  invoice: any
  items: any[]
  customer: any | null
  store: any | null
  settings: any | null
}

/**
 * Ensures invoice exists in Supabase by checking and uploading from IndexedDB if needed
 * Returns invoice data ready for PDF generation
 */
export async function ensureInvoiceInSupabaseForPDF(
  invoiceId: string
): Promise<InvoicePDFData> {
  const supabase = createClient()
  const isIndexedDb = isIndexedDbMode()

  // If not in IndexedDB mode, just fetch from Supabase
  if (!isIndexedDb) {
    return await fetchInvoiceFromSupabase(invoiceId)
  }

  // Check if invoice exists in Supabase
  const { data: existingInvoice, error: checkError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle()

  // If invoice exists in Supabase, fetch full data
  if (existingInvoice && !checkError) {
    console.log("[InvoicePDFSync] Invoice found in Supabase, fetching full data")
    return await fetchInvoiceFromSupabase(invoiceId)
  }

  // Invoice doesn't exist in Supabase, fetch from IndexedDB and upload
  console.log("[InvoicePDFSync] Invoice not found in Supabase, fetching from IndexedDB and uploading")

  // Fetch from IndexedDB
  const invoice = await db.invoices.get(invoiceId)
  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found in IndexedDB`)
  }

  const items = await db.invoice_items.where("invoice_id").equals(invoiceId).toArray()
  const customer = invoice.customer_id ? await db.customers.get(invoice.customer_id) : null
  const store = invoice.store_id ? await db.stores.get(invoice.store_id) : null

  // Get user for Supabase upload
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.warn("[InvoicePDFSync] Not authenticated, will generate PDF from IndexedDB data only")
    // Return IndexedDB data even if we can't upload
    return {
      invoice,
      items,
      customer,
      store,
      settings: null,
    }
  }

  // Upload invoice to Supabase
  try {
    // Prepare invoice data for Supabase (convert camelCase to snake_case if needed)
    const invoiceData = {
      id: invoice.id,
      user_id: user.id,
      customer_id: invoice.customer_id || null,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date || null,
      status: invoice.status || "draft",
      is_gst_invoice: invoice.is_gst_invoice || false,
      subtotal: invoice.subtotal || 0,
      discount_amount: invoice.discount_amount || 0,
      cgst_amount: invoice.cgst_amount || 0,
      sgst_amount: invoice.sgst_amount || 0,
      igst_amount: invoice.igst_amount || 0,
      total_amount: invoice.total_amount || 0,
      notes: invoice.notes || null,
      terms: invoice.terms || null,
      store_id: invoice.store_id || null,
      created_at: invoice.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_synced: true,
    }

    // Upsert invoice
    const { error: invoiceError } = await supabase
      .from("invoices")
      .upsert(invoiceData, { onConflict: "id" })

    if (invoiceError) {
      console.error("[InvoicePDFSync] Error uploading invoice to Supabase:", invoiceError)
      // Don't throw - return IndexedDB data as fallback
      return {
        invoice,
        items,
        customer,
        store,
        settings: null,
      }
    }

    // Upload invoice items
    if (items.length > 0) {
      // Delete existing items first
      await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId)

      // Insert new items
      const itemsData = items.map((item) => ({
        id: item.id,
        invoice_id: item.invoice_id,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
        gst_rate: item.gst_rate || 0,
        hsn_code: item.hsn_code || null,
        line_total: item.line_total || 0,
        gst_amount: item.gst_amount || 0,
      }))

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(itemsData)

      if (itemsError) {
        console.error("[InvoicePDFSync] Error uploading invoice items to Supabase:", itemsError)
        // Continue anyway - we can still generate PDF from IndexedDB data
      }
    }

    console.log("[InvoicePDFSync] Successfully uploaded invoice to Supabase")

    // Fetch settings if available
    let settings = null
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()
      settings = profileData
    } catch (err) {
      console.warn("[InvoicePDFSync] Could not fetch settings:", err)
    }

    // Return the uploaded data
    return {
      invoice: invoiceData,
      items: items.map((item) => ({
        ...item,
        invoice_id: item.invoice_id,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
        gst_rate: item.gst_rate || 0,
        hsn_code: item.hsn_code || null,
        line_total: item.line_total || 0,
        gst_amount: item.gst_amount || 0,
      })),
      customer,
      store,
      settings,
    }
  } catch (error) {
    console.error("[InvoicePDFSync] Error during Supabase upload, using IndexedDB data:", error)
    // Return IndexedDB data as fallback
    return {
      invoice,
      items,
      customer,
      store,
      settings: null,
    }
  }
}

/**
 * Fetches invoice data from Supabase
 */
async function fetchInvoiceFromSupabase(invoiceId: string): Promise<InvoicePDFData> {
  const supabase = createClient()

  // Fetch invoice and items in parallel
  const [{ data: invoice, error: invoiceError }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", invoiceId).single(),
    supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId),
  ])

  if (invoiceError || !invoice) {
    throw new Error(`Invoice ${invoiceId} not found in Supabase`)
  }

  if (itemsError) {
    console.error("[InvoicePDFSync] Error fetching items:", itemsError)
  }

  // Fetch customer if available
  let customer: any = null
  if (invoice.customer_id) {
    const { data: custData } = await supabase
      .from("customers")
      .select("*")
      .eq("id", invoice.customer_id)
      .maybeSingle()
    customer = custData
  }

  // Fetch store if available
  let store: any = null
  if (invoice.store_id) {
    const { data: storeData } = await supabase
      .from("stores")
      .select("*")
      .eq("id", invoice.store_id)
      .maybeSingle()
    store = storeData
  }

  // Fetch business settings
  let settings: any = null
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
    settings = profileData
  }

  return {
    invoice,
    items: items || [],
    customer,
    store,
    settings,
  }
}

/**
 * Generates PDF data structure from invoice data (works with both Supabase and IndexedDB formats)
 */
export function preparePDFDataFromInvoice(invoiceData: InvoicePDFData): any {
  const { invoice, items, customer, store, settings } = invoiceData

  return {
    invoiceNumber: invoice.invoice_number || invoice.invoiceNumber || "N/A",
    invoiceDate: invoice.invoice_date || invoice.invoiceDate || new Date().toISOString(),
    customerName: customer?.name || "",
    customerEmail: customer?.email || "",
    customerPhone: customer?.phone || "",
    customerGSTIN: customer?.gstin || customer?.gstin || "",
    businessName: store?.name || settings?.business_name || "Business",
    businessGSTIN: settings?.business_gstin || "",
    businessAddress: settings?.business_address || "",
    businessPhone: settings?.business_phone || "",
    items: items.map((item: any) => {
      const quantity = Number(item.quantity) || 0
      const unitPrice = Number(item.unit_price || item.unitPrice) || 0
      const discountPercent = Number(item.discount_percent || item.discountPercent) || 0
      const gstRate = Number(item.gst_rate || item.gstRate) || 0
      
      // Calculate line total and GST
      const lineSubtotal = quantity * unitPrice
      const discountAmount = (lineSubtotal * discountPercent) / 100
      const taxableAmount = lineSubtotal - discountAmount
      const gstAmount = (invoice.is_gst_invoice || invoice.isGstInvoice)
        ? (taxableAmount * gstRate) / 100
        : 0
      const lineTotal = taxableAmount + gstAmount

      return {
        description: item.description || "",
        quantity,
        unitPrice,
        discountPercent,
        gstRate,
        lineTotal: item.line_total || item.lineTotal || lineTotal,
        gstAmount: item.gst_amount || item.gstAmount || gstAmount,
      }
    }),
    subtotal: Number(invoice.subtotal) || 0,
    cgstAmount: Number(invoice.cgst_amount || invoice.cgstAmount) || 0,
    sgstAmount: Number(invoice.sgst_amount || invoice.sgstAmount) || 0,
    igstAmount: Number(invoice.igst_amount || invoice.igstAmount) || 0,
    totalAmount: Number(invoice.total_amount || invoice.totalAmount) || 0,
    isGstInvoice: invoice.is_gst_invoice || invoice.isGstInvoice || false,
  }
}

