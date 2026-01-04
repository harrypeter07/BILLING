import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { InvoicePDFData } from "@/lib/utils/invoice-pdf";

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
    const invoiceData: InvoicePDFData = {
      invoiceNumber: invoice.invoice_number || invoice.invoiceNumber || "N/A",
      invoiceDate: invoice.invoice_date || invoice.invoiceDate || new Date().toISOString(),
      dueDate: invoice.due_date || invoice.dueDate,
      customerName: customer?.name || "",
      customerEmail: customer?.email || "",
      customerPhone: customer?.phone || "",
      customerGSTIN: customer?.gstin || "",
      businessName: store?.name || settings?.business_name || "Business",
      businessGSTIN: settings?.business_gstin || "",
      businessAddress: settings?.business_address || "",
      businessPhone: settings?.business_phone || "",
      businessEmail: settings?.business_email || "",
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
      notes: invoice.notes || "",
      terms: invoice.terms || "",
      isGstInvoice: invoice.is_gst_invoice || invoice.isGstInvoice || false,
    };

    const html = generateInvoiceHTML(invoiceData);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error generating invoice HTML:", error);
    return NextResponse.json(
      { error: "Failed to generate invoice HTML" },
      { status: 500 }
    );
  }
}

function generateInvoiceHTML(data: InvoicePDFData): string {
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
  <title>Invoice ${data.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1e293b;
      background: #fff;
      padding: 20px;
      line-height: 1.6;
    }
    .invoice-container {
      max-width: 210mm;
      margin: 0 auto;
      background: white;
      padding: 30px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 20px;
    }
    .logo-section {
      flex: 1;
    }
    .logo {
      max-width: 120px;
      max-height: 60px;
      object-fit: contain;
    }
    .business-info {
      flex: 1;
      text-align: right;
    }
    .business-name {
      font-size: 24px;
      font-weight: bold;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .business-details {
      font-size: 11px;
      color: #64748b;
      line-height: 1.8;
    }
    .invoice-title {
      font-size: 36px;
      font-weight: bold;
      color: #3b82f6;
      text-align: center;
      margin: 20px 0;
    }
    .details-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 30px;
    }
    .detail-box {
      background: #f8fafc;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .detail-label {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    .detail-value {
      font-size: 13px;
      color: #1e293b;
      font-weight: 500;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .items-table thead {
      background: #3b82f6;
      color: white;
    }
    .items-table th {
      padding: 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .items-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
    }
    .items-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .items-table tbody tr:hover {
      background: #f1f5f9;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }
    .totals-table {
      width: 300px;
    }
    .totals-table td {
      padding: 8px 0;
      font-size: 12px;
    }
    .totals-table td:first-child {
      color: #64748b;
    }
    .totals-table td:last-child {
      text-align: right;
      font-weight: 500;
      color: #1e293b;
    }
    .total-row {
      border-top: 2px solid #3b82f6;
      padding-top: 10px;
      margin-top: 10px;
    }
    .total-row td {
      font-size: 18px;
      font-weight: bold;
      color: #3b82f6;
    }
    .notes-section, .terms-section {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    .section-title {
      font-size: 13px;
      font-weight: bold;
      color: #1e293b;
      margin-bottom: 10px;
    }
    .section-content {
      font-size: 11px;
      color: #64748b;
      line-height: 1.8;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    .served-by {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 20px;
      text-align: right;
    }
    @media print {
      body {
        padding: 0;
      }
      .invoice-container {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="logo-section">
        ${data.logoUrl ? `<img src="${data.logoUrl}" alt="Logo" class="logo" />` : ""}
      </div>
      <div class="business-info">
        <div class="business-name">${data.businessName}</div>
        <div class="business-details">
          ${data.businessAddress ? `<div>${data.businessAddress}</div>` : ""}
          ${data.businessPhone ? `<div>Phone: ${data.businessPhone}</div>` : ""}
          ${data.businessEmail ? `<div>Email: ${data.businessEmail}</div>` : ""}
          ${data.businessGSTIN ? `<div>GSTIN: ${data.businessGSTIN}</div>` : ""}
        </div>
      </div>
    </div>

    <div class="invoice-title">INVOICE</div>

    <div class="details-section">
      <div class="detail-box">
        <div class="detail-label">Invoice Details</div>
        <div class="detail-value" style="font-size: 14px; font-weight: bold; margin-bottom: 8px;">
          Invoice #: ${data.invoiceNumber}
        </div>
        <div class="detail-value">Date: ${formatDate(data.invoiceDate)}</div>
        ${data.dueDate ? `<div class="detail-value">Due Date: ${formatDate(data.dueDate)}</div>` : ""}
      </div>
      ${data.customerName ? `
      <div class="detail-box">
        <div class="detail-label">Bill To</div>
        <div class="detail-value" style="font-size: 14px; font-weight: bold; margin-bottom: 8px;">
          ${data.customerName}
        </div>
        ${data.customerEmail ? `<div class="detail-value">${data.customerEmail}</div>` : ""}
        ${data.customerPhone ? `<div class="detail-value">${data.customerPhone}</div>` : ""}
        ${data.customerGSTIN ? `<div class="detail-value">GSTIN: ${data.customerGSTIN}</div>` : ""}
      </div>
      ` : ""}
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-center">Qty</th>
          <th class="text-right">Unit Price</th>
          ${data.isGstInvoice ? `<th class="text-center">GST %</th><th class="text-right">GST Amount</th>` : ""}
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map(item => `
        <tr>
          <td>${item.description}</td>
          <td class="text-center">${item.quantity}</td>
          <td class="text-right">${formatCurrency(item.unitPrice)}</td>
          ${data.isGstInvoice ? `
          <td class="text-center">${item.gstRate}%</td>
          <td class="text-right">${formatCurrency(item.gstAmount)}</td>
          ` : ""}
          <td class="text-right">${formatCurrency(item.lineTotal)}</td>
        </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="totals-section">
      <table class="totals-table">
        <tr>
          <td>Subtotal:</td>
          <td>${formatCurrency(data.subtotal)}</td>
        </tr>
        ${data.isGstInvoice ? `
        ${data.cgstAmount > 0 ? `
        <tr>
          <td>CGST:</td>
          <td>${formatCurrency(data.cgstAmount)}</td>
        </tr>
        ` : ""}
        ${data.sgstAmount > 0 ? `
        <tr>
          <td>SGST:</td>
          <td>${formatCurrency(data.sgstAmount)}</td>
        </tr>
        ` : ""}
        ${data.igstAmount > 0 ? `
        <tr>
          <td>IGST:</td>
          <td>${formatCurrency(data.igstAmount)}</td>
        </tr>
        ` : ""}
        ` : ""}
        <tr class="total-row">
          <td>Total:</td>
          <td>${formatCurrency(data.totalAmount)}</td>
        </tr>
      </table>
    </div>

    ${data.notes ? `
    <div class="notes-section">
      <div class="section-title">Notes:</div>
      <div class="section-content">${data.notes}</div>
    </div>
    ` : ""}

    ${data.terms ? `
    <div class="terms-section">
      <div class="section-title">Terms & Conditions:</div>
      <div class="section-content">${data.terms}</div>
    </div>
    ` : ""}

    ${data.servedBy ? `
    <div class="served-by">Served by: ${data.servedBy}</div>
    ` : ""}

    <div class="footer">
      Thank you for your business!
    </div>
  </div>
</body>
</html>`;
}

