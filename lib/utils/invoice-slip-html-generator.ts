/**
 * Shared HTML generator for invoice slip (used by both server and client)
 */
import type { InvoiceSlipData } from "./invoice-slip-pdf";

export function generateSlipHTML(data: InvoiceSlipData): string {
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
      color: #ec4899;
    }
    .divider {
      border-top: 1px solid #f9a8d4;
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
      color: #ec4899;
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
      background: #ec4899;
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
      border-top: 2px solid #ec4899;
      padding-top: 2mm;
      margin-top: 2mm;
      color: #ec4899;
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
    <div class="logo-section">
      <img src="${
				data.logoUrl ||
				"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjZWM0ODk5Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxPR088L3RleHQ+PC9zdmc+"
			}" alt="Logo" class="logo" onerror="this.style.display='none'" />
    </div>
    
    <div class="business-name">${data.businessName}</div>
    
    <div class="divider"></div>
    
    <div class="invoice-info">
      <div>Invoice #: ${data.invoiceNumber}</div>
      <div>Date: ${formatDate(data.invoiceDate)}</div>
    </div>
    
    <div class="divider"></div>
    
    ${
			data.customerName
				? `
    <div class="customer-section">
      <div class="customer-label">Bill To:</div>
      <div class="customer-name">${data.customerName}</div>
    </div>
    <div class="divider"></div>
    `
				: ""
		}
    
    <table class="items-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${data.items
					.map(
						(item) => `
        <tr>
          <td>${item.description.substring(0, 20)}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(item.lineTotal)}</td>
        </tr>
        `
					)
					.join("")}
      </tbody>
    </table>
    
    <div class="divider"></div>
    
    <div class="totals">
      <div class="total-row">
        <span>Subtotal:</span>
        <span>${formatCurrency(data.subtotal)}</span>
      </div>
      ${
				data.isGstInvoice
					? `
      ${
				data.cgstAmount > 0
					? `
      <div class="total-row">
        <span>CGST:</span>
        <span>${formatCurrency(data.cgstAmount)}</span>
      </div>
      `
					: ""
			}
      ${
				data.sgstAmount > 0
					? `
      <div class="total-row">
        <span>SGST:</span>
        <span>${formatCurrency(data.sgstAmount)}</span>
      </div>
      `
					: ""
			}
      ${
				data.igstAmount > 0
					? `
      <div class="total-row">
        <span>IGST:</span>
        <span>${formatCurrency(data.igstAmount)}</span>
      </div>
      `
					: ""
			}
      `
					: ""
			}
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
