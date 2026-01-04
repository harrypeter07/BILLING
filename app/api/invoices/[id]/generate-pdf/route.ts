import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const invoiceId = resolvedParams.id;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "invoice"; // "invoice" or "slip"

    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID is required" }, { status: 400 });
    }

    // Get the base URL for the HTML endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    request.headers.get("host") ? 
                    `http://${request.headers.get("host")}` : 
                    "http://localhost:3000";

    const htmlUrl = type === "slip" 
      ? `${baseUrl}/api/invoices/${invoiceId}/slip-html`
      : `${baseUrl}/api/invoices/${invoiceId}/html`;

    // Launch puppeteer with Vercel-compatible Chromium
    // In production (Vercel), use @sparticuz/chromium
    // In development, try to use local Chrome or fallback
    const isProduction = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
    
    let browser;
    if (isProduction) {
      // Only import chromium in production (Vercel)
      const chromium = await import("@sparticuz/chromium");
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      // Development: use local Chrome
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        // In development, try to find Chrome in common locations
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      });
    }

    try {
      const page = await browser.newPage();
      
      // Navigate to the HTML page
      await page.goto(htmlUrl, {
        waitUntil: "networkidle0",
        timeout: 30000,
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
          "Content-Disposition": `inline; filename="invoice-${invoiceId}-${type}.pdf"`,
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

