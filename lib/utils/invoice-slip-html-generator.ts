/**
 * Shared HTML generator for invoice slip (used by both server and client)
 */
import type { InvoiceSlipData } from "./invoice-slip-pdf";

export function generateSlipHTML(data: InvoiceSlipData): string {
	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});
	};

	const formatTime = (dateStr: string) => {
		const date = new Date(dateStr);
		return date.toLocaleTimeString("en-IN", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		});
	};

	const formatCurrency = (amount: number) => {
		return `₹${amount.toFixed(2)}`;
	};

	// Calculate total quantity
	const totalQty = data.items.reduce((sum, item) => sum + item.quantity, 0);

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
    @page {
      size: 80mm auto;
      margin: 6mm;
    }
    body {
      font-family: 'Courier New', monospace;
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
      min-height: 200mm;
    }
    .logo-section {
      text-align: center;
      margin-bottom: 4mm;
    }
    .logo {
      max-width: 20mm;
      max-height: 20mm;
      object-fit: contain;
    }
    .business-name {
      font-size: 12pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 2mm;
      text-transform: uppercase;
    }
    .business-address {
      font-size: 7pt;
      text-align: center;
      margin-bottom: 1mm;
      color: #475569;
    }
    .business-phone {
      font-size: 7pt;
      text-align: center;
      margin-bottom: 4mm;
      color: #475569;
    }
    .divider {
      border-top: 1px dashed #cbd5e1;
      margin: 3mm 0;
    }
    .invoice-type {
      font-size: 8pt;
      text-align: center;
      font-weight: bold;
      margin-bottom: 3mm;
      text-transform: uppercase;
    }
    .invoice-details {
      font-size: 7pt;
      margin-bottom: 3mm;
      display: flex;
      flex-direction: column;
      gap: 1mm;
    }
    .invoice-details-row {
      display: flex;
      justify-content: space-between;
    }
    .customer-section {
      margin-bottom: 3mm;
    }
    .customer-label {
      font-size: 7pt;
      font-weight: bold;
      margin-bottom: 1mm;
    }
    .customer-name {
      font-size: 7pt;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 3mm;
      font-size: 7pt;
      page-break-inside: auto;
    }
    .items-table tbody tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    .items-table thead {
      display: table-header-group;
    }
    .items-table tbody {
      display: table-row-group;
    }
    .items-table thead {
      background: #1e293b;
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
      width: 12mm;
    }
    .items-table th:nth-child(3),
    .items-table td:nth-child(3) {
      text-align: center;
      width: 15mm;
    }
    .items-table th:last-child,
    .items-table td:last-child {
      text-align: right;
      width: 20mm;
    }
    .items-table td {
      padding: 1.5mm 2mm;
      border-bottom: 0.5px solid #e2e8f0;
      font-size: 7pt;
    }
    .totals {
      margin-top: 3mm;
      font-size: 7.5pt;
      page-break-inside: avoid;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1mm;
    }
    .total-row.bold {
      font-weight: bold;
      font-size: 10pt;
      border-top: 2px solid #1e293b;
      padding-top: 2mm;
      margin-top: 2mm;
      page-break-inside: avoid;
    }
    .payment-section {
      margin-top: 4mm;
      margin-bottom: 3mm;
      page-break-inside: avoid;
    }
    .payment-mode {
      font-size: 7pt;
      text-align: center;
      margin-bottom: 2mm;
    }
    .qr-placeholder {
      width: 40mm;
      height: 40mm;
      background: #000;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 6pt;
      text-align: center;
      padding: 2mm;
    }
    .qr-label {
      font-size: 7pt;
      text-align: center;
      margin-top: 1mm;
      color: #64748b;
    }
    .footer {
      text-align: center;
      font-size: 7pt;
      color: #64748b;
      margin-top: 4mm;
      padding-top: 3mm;
      border-top: 1px dashed #e2e8f0;
      page-break-inside: avoid;
    }
    /* Ensure critical sections stay together */
    .totals-section-wrapper {
      page-break-inside: avoid;
    }
    /* Prevent items from breaking across pages */
    .items-wrapper {
      page-break-inside: auto;
    }
    .footer-line {
      margin-bottom: 1mm;
    }
  </style>
</head>
<body>
  <div class="slip-container">
    <!-- Logo at top center -->
    <div class="logo-section">
      ${data.logoUrl && data.logoUrl.trim() !== "" ? `
      <img src="${data.logoUrl}" alt="Logo" class="logo" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjMWUyOTNiIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxPR088L3RleHQ+PC9zdmc+';" />
      ` : `
      <div class="logo" style="width: 20mm; height: 20mm; background: #1e293b; display: flex; align-items: center; justify-content: center; color: white; font-size: 10pt; margin: 0 auto;">LOGO</div>
      `}
    </div>
    
    <!-- Business Name -->
    <div class="business-name">${data.businessName || "BUSINESS NAME"}</div>
    
    <!-- Business Address -->
    ${data.businessAddress ? `<div class="business-address">${data.businessAddress}</div>` : ""}
    
    <!-- Business GSTIN (B2B mode) -->
    ${(data.isB2B || data.businessGSTIN) ? `<div class="business-address">GSTIN: ${data.businessGSTIN || "N/A"}</div>` : ""}
    
    <!-- Business Phone -->
    ${data.businessPhone ? `<div class="business-phone">Mob: ${data.businessPhone}</div>` : ""}
    
    <!-- Business Email (B2B mode) -->
    ${(data.isB2B && data.businessEmail) ? `<div class="business-phone">Email: ${data.businessEmail}</div>` : ""}
    
    <div class="divider"></div>
    
    <!-- ESTIMATE / SLIP / TAX INVOICE -->
    <div class="invoice-type">${data.isB2B ? "TAX INVOICE (B2B)" : "ESTIMATE / SLIP"}</div>
    
    <!-- Invoice Details -->
    <div class="invoice-details">
      <div class="invoice-details-row">
        <span>Date:</span>
        <span>${formatDate(data.invoiceDate)}</span>
      </div>
      <div class="invoice-details-row">
        <span>Time:</span>
        <span>${formatTime(data.invoiceDate)}</span>
      </div>
      <div class="invoice-details-row">
        <span>Bill No:</span>
        <span>${data.invoiceNumber}</span>
      </div>
      ${data.servedBy ? `
      <div class="invoice-details-row">
        <span>Cashier:</span>
        <span>${data.servedBy}</span>
      </div>
      ` : ""}
    </div>
    
    <div class="divider"></div>
    
    <!-- Customer Section -->
    ${data.customerName ? `
    <div class="customer-section">
      <div class="customer-label">Bill To:</div>
      <div class="customer-name">${data.customerName}</div>
      ${(data.isB2B && data.customerBillingAddress) || data.customerAddress ? `<div class="customer-name" style="margin-top: 1mm;">${data.customerBillingAddress || data.customerAddress}</div>` : ""}
      ${(data.isB2B && data.customerCity) ? `<div class="customer-name">${data.customerCity}${data.customerState ? `, ${data.customerState}` : ""}${data.customerPincode ? ` - ${data.customerPincode}` : ""}</div>` : ""}
      ${(data.isB2B && data.customerEmail) ? `<div class="customer-name">Email: ${data.customerEmail}</div>` : ""}
      ${data.customerPhone ? `<div class="customer-name">Phone: ${data.customerPhone}</div>` : ""}
      ${(data.isB2B || data.customerGSTIN) ? `<div class="customer-name">GSTIN: ${data.customerGSTIN || "N/A"}</div>` : ""}
    </div>
    <div class="divider"></div>
    ` : ""}
    
    <!-- Items Table -->
    <div class="items-wrapper">
      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Amt</th>
          </tr>
        </thead>
        <tbody>
          ${data.items
					.map(
						(item, index) => `
          <tr>
            <td>${index + 1}. ${item.description.substring(0, 25)}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.unitPrice)}</td>
            <td>${formatCurrency(item.lineTotal)}</td>
          </tr>
          `
					)
					.join("")}
        </tbody>
      </table>
    </div>
    
    <div class="divider"></div>
    
    <!-- Totals -->
    <div class="totals-section-wrapper">
    <div class="totals">
      <div class="total-row">
        <span>Total Qty:</span>
        <span>${totalQty}</span>
      </div>
      <div class="total-row bold">
        <span>TOTAL AMOUNT:</span>
        <span>${formatCurrency(data.totalAmount)}</span>
      </div>
    </div>
    </div>
    
    <div class="divider"></div>
    
    <!-- Payment Section -->
    <div class="payment-section">
      <div class="payment-mode">Mode: UPI / CASH</div>
      <div class="qr-placeholder">
        [ SCAN TO PAY - QR CODE ]<br/>
        (UPI@bankname)
      </div>
      <div class="qr-label">Scan QR Code to Pay</div>
    </div>
    
    <div class="divider"></div>
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-line">* No Exchange/Refund *</div>
      <div class="footer-line">* Thank You Visit Again *</div>
    </div>
  </div>
</body>
</html>`;
}
