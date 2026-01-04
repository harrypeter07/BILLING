import { NextRequest, NextResponse } from "next/server";
import type { InvoicePDFData } from "@/lib/utils/invoice-pdf";
import { generateInvoiceHTML } from "@/lib/utils/invoice-html-generator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Use mock data for HTML preview (no API calls)
    // This allows real-time editing of the HTML template
    // You can replace this with your actual logo URL from customer uploads
    const mockLogoUrl = "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=120&h=60&fit=crop&auto=format";
    
    const invoiceData: InvoicePDFData = {
      invoiceNumber: "INV-2024-001",
      invoiceDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      customerName: "John Doe",
      customerEmail: "john.doe@example.com",
      customerPhone: "+91 98765 43210",
      customerGSTIN: "29ABCDE1234F1Z5",
      businessName: "My Business Name",
      businessGSTIN: "29ABCDE1234F1Z5",
      businessAddress: "123 Business Street, City, State - 123456",
      businessPhone: "+91 12345 67890",
      businessEmail: "business@example.com",
      logoUrl: mockLogoUrl, // Replace with actual logo from customer uploads
      servedBy: "Admin User",
      items: [
        {
          description: "Product 1 - Sample Item",
          quantity: 2,
          unitPrice: 500.00,
          discountPercent: 10,
          gstRate: 18,
          lineTotal: 1062.00,
          gstAmount: 162.00,
        },
        {
          description: "Product 2 - Another Item",
          quantity: 1,
          unitPrice: 1000.00,
          discountPercent: 5,
          gstRate: 18,
          lineTotal: 1121.00,
          gstAmount: 171.00,
        },
        {
          description: "Product 3 - Third Item",
          quantity: 3,
          unitPrice: 250.00,
          discountPercent: 0,
          gstRate: 12,
          lineTotal: 840.00,
          gstAmount: 90.00,
        },
      ],
      subtotal: 2800.00,
      cgstAmount: 211.50,
      sgstAmount: 211.50,
      igstAmount: 0,
      totalAmount: 3223.00,
      notes: "Thank you for your business! Payment is due within 30 days.",
      terms: "1. Payment due within 30 days.\n2. Late payment charges may apply.\n3. Goods once sold will not be taken back.",
      isGstInvoice: true,
    };

    // Use shared HTML generator
    const html = generateInvoiceHTML(invoiceData);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
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
