import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { InvoiceSlipData } from "@/lib/utils/invoice-slip-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const invoiceId = resolvedParams.id;

    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID is required" }, { status: 400 });
    }

    // Create server-side Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
            } catch {
              // Ignore cookie setting errors in API routes
            }
          },
        },
      }
    );

    // Fetch invoice data from Supabase
    const [{ data: invoice, error: invoiceError }, { data: items, error: itemsError }] = await Promise.all([
      supabase.from("invoices").select("*").eq("id", invoiceId).single(),
      supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId),
    ]);

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Fetch customer if available
    let customer: any = null;
    if (invoice.customer_id) {
      const { data: custData } = await supabase
        .from("customers")
        .select("*")
        .eq("id", invoice.customer_id)
        .maybeSingle();
      customer = custData;
    }

    // Fetch store if available
    let store: any = null;
    if (invoice.store_id) {
      const { data: storeData } = await supabase
        .from("stores")
        .select("*")
        .eq("id", invoice.store_id)
        .maybeSingle();
      store = storeData;
    }

    // Fetch business settings
    let settings: any = null;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      settings = profileData;
    }

    // Prepare PDF data
    const invoiceData: InvoiceSlipData = {
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
      logoUrl: settings?.logo_url || "",
      servedBy: invoice.created_by_employee_id ? "Employee" : undefined,
      items: (items || []).map((item: any) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unit_price || item.unitPrice) || 0;
        const discountPercent = Number(item.discount_percent || item.discountPercent) || 0;
        const gstRate = Number(item.gst_rate || item.gstRate) || 0;
        const lineSubtotal = quantity * unitPrice;
        const discountAmount = (lineSubtotal * discountPercent) / 100;
        const taxableAmount = lineSubtotal - discountAmount;
        const gstAmount = (invoice.is_gst_invoice || invoice.isGstInvoice)
          ? (taxableAmount * gstRate) / 100
          : 0;
        const lineTotal = taxableAmount + gstAmount;
        return {
          description: item.description || "",
          quantity,
          unitPrice,
          discountPercent,
          gstRate,
          lineTotal: item.line_total || item.lineTotal || lineTotal,
          gstAmount: item.gst_amount || item.gstAmount || gstAmount,
        };
      }),
      subtotal: Number(invoice.subtotal) || 0,
      cgstAmount: Number(invoice.cgst_amount || invoice.cgstAmount) || 0,
      sgstAmount: Number(invoice.sgst_amount || invoice.sgstAmount) || 0,
      igstAmount: Number(invoice.igst_amount || invoice.igstAmount) || 0,
      totalAmount: Number(invoice.total_amount || invoice.totalAmount) || 0,
      isGstInvoice: invoice.is_gst_invoice || invoice.isGstInvoice || false,
    };

    const html = generateSlipHTML(invoiceData);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error generating slip HTML:", error);
    return NextResponse.json(
      { error: "Failed to generate slip HTML" },
      { status: 500 }
    );
  }
}

function generateSlipHTML(data: InvoiceSlipData): string {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice Slip ${data.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #0f172a;
      background: #fff;
      padding: 10px;
      line-height: 1.4;
    }
    .slip-container {
      width: 80mm;
      max-width: 80mm;
      margin: 0 auto;
      background: white;
      padding: 6mm;
    }
    .logo-section {
      text-align: center;
      margin-bottom: 4mm;
    }
    .logo {
      max-width: 18mm;
      max-height: 18mm;
      object-fit: contain;
    }
    .business-name {
      font-size: 11pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 4mm;
      color: #0f172a;
    }
    .divider {
      border-top: 1px solid #64748b;
      margin: 4mm 0;
    }
    .invoice-info {
      font-size: 7.5pt;
      margin-bottom: 4mm;
    }
    .invoice-info div {
      margin-bottom: 1mm;
    }
    .customer-section {
      margin-bottom: 4mm;
    }
    .customer-label {
      font-size: 7.5pt;
      font-weight: bold;
      margin-bottom: 1mm;
    }
    .customer-name {
      font-size: 7.5pt;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4mm;
      font-size: 7pt;
    }
    .items-table thead {
      background: #2563eb;
      color: white;
    }
    .items-table th {
      padding: 2mm;
      text-align: left;
      font-weight: bold;
      font-size: 7pt;
    }
    .items-table th:nth-child(2),
    .items-table td:nth-child(2) {
      text-align: center;
      width: 10mm;
    }
    .items-table th:last-child,
    .items-table td:last-child {
      text-align: right;
      width: 18mm;
    }
    .items-table td {
      padding: 1.5mm 2mm;
      border-bottom: 0.5px solid #e2e8f0;
      font-size: 7pt;
    }
    .totals {
      margin-top: 4mm;
      font-size: 7.5pt;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1mm;
    }
    .total-row.bold {
      font-weight: bold;
      font-size: 10pt;
      border-top: 1px solid #64748b;
      padding-top: 2mm;
      margin-top: 2mm;
      color: #2563eb;
    }
    .footer {
      text-align: center;
      font-size: 7pt;
      color: #64748b;
      margin-top: 4mm;
      padding-top: 4mm;
      border-top: 1px solid #e2e8f0;
    }
    @media print {
      body {
        padding: 0;
      }
      .slip-container {
        padding: 6mm;
      }
    }
  </style>
</head>
<body>
  <div class="slip-container">
    ${data.logoUrl ? `
    <div class="logo-section">
      <img src="${data.logoUrl}" alt="Logo" class="logo" />
    </div>
    ` : ""}
    
    <div class="business-name">${data.businessName}</div>
    
    <div class="divider"></div>
    
    <div class="invoice-info">
      <div>Invoice #: ${data.invoiceNumber}</div>
      <div>Date: ${formatDate(data.invoiceDate)}</div>
    </div>
    
    <div class="divider"></div>
    
    ${data.customerName ? `
    <div class="customer-section">
      <div class="customer-label">Bill To:</div>
      <div class="customer-name">${data.customerName}</div>
    </div>
    <div class="divider"></div>
    ` : ""}
    
    <table class="items-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map(item => `
        <tr>
          <td>${item.description.substring(0, 20)}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(item.lineTotal)}</td>
        </tr>
        `).join("")}
      </tbody>
    </table>
    
    <div class="divider"></div>
    
    <div class="totals">
      <div class="total-row">
        <span>Subtotal:</span>
        <span>${formatCurrency(data.subtotal)}</span>
      </div>
      ${data.isGstInvoice ? `
      ${data.cgstAmount > 0 ? `
      <div class="total-row">
        <span>CGST:</span>
        <span>${formatCurrency(data.cgstAmount)}</span>
      </div>
      ` : ""}
      ${data.sgstAmount > 0 ? `
      <div class="total-row">
        <span>SGST:</span>
        <span>${formatCurrency(data.sgstAmount)}</span>
      </div>
      ` : ""}
      ${data.igstAmount > 0 ? `
      <div class="total-row">
        <span>IGST:</span>
        <span>${formatCurrency(data.igstAmount)}</span>
      </div>
      ` : ""}
      ` : ""}
      <div class="total-row bold">
        <span>TOTAL:</span>
        <span>${formatCurrency(data.totalAmount)}</span>
      </div>
    </div>
    
    <div class="footer">
      Thank you for your purchase!
    </div>
  </div>
</body>
</html>`;
}

