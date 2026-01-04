import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import type { InvoicePDFData } from "@/lib/utils/invoice-pdf";
import type { InvoiceSlipData } from "@/lib/utils/invoice-slip-pdf";
import { generateInvoiceHTML } from "@/lib/utils/invoice-html-generator";
import { generateSlipHTML } from "@/lib/utils/invoice-slip-html-generator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, type = "invoice" } = body;

    if (!data) {
      return NextResponse.json({ error: "Invoice data is required" }, { status: 400 });
    }

    // Ensure logoUrl is always present, use a placeholder if not provided
    const dataWithLogo = {
      ...data,
      logoUrl: data.logoUrl || (type === "slip" 
        ? "https://via.placeholder.com/80x40/EC4899/FFFFFF?text=Logo" // Pink placeholder for slip
        : "https://via.placeholder.com/120x60/0000FF/FFFFFF?text=Logo") // Blue placeholder for invoice
    };

    // Generate HTML based on type using shared HTML generators
    const html = type === "slip" 
      ? generateSlipHTML(dataWithLogo as InvoiceSlipData)
      : generateInvoiceHTML(dataWithLogo as InvoicePDFData);

    // Launch puppeteer with Vercel-compatible Chromium
    // In production (Vercel), use @sparticuz/chromium
    // In development, try to use local Chrome or fallback
    const isProduction = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
    
    const browser = await puppeteer.launch(
      isProduction
        ? {
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
          }
        : {
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
            // In development, try to find Chrome in common locations
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
          }
    );

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
