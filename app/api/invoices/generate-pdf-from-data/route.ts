import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import type { InvoicePDFData } from "@/lib/utils/invoice-pdf";
import type { InvoiceSlipData } from "@/lib/utils/invoice-slip-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, type = "invoice" } = body;

    if (!data) {
      return NextResponse.json({ error: "Invoice data is required" }, { status: 400 });
    }

    // Generate HTML based on type
    const html = type === "slip" 
      ? generateSlipHTML(data as InvoiceSlipData)
      : generateInvoiceHTML(data as InvoicePDFData);

    // Launch puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      
      // Set HTML content
      await page.setContent(html, {
        waitUntil: "networkidle0",
      });

      // Generate PDF
      const pdfOptions: any = {
        printBackground: true,
        margin: {
          top: type === "slip" ? "6mm" : "0",
          right: type === "slip" ? "6mm" : "0",
          bottom: type === "slip" ? "6mm" : "0",
          left: type === "slip" ? "6mm" : "0",
        },
      };

      if (type === "slip") {
        // Custom size for slip: 80mm x 200mm
        pdfOptions.width = "80mm";
        pdfOptions.height = "200mm";
      } else {
        // Standard A4 format for invoice
        pdfOptions.format = "A4";
      }

      const pdf = await page.pdf(pdfOptions);

      await browser.close();

      return new NextResponse(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="invoice-${type}.pdf"`,
        },
      });
    } catch (error) {
      await browser.close();
      throw error;
    }
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: error instanceof Error ? error.message : String(error) },
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

