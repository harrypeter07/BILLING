import { excelSheetManager } from "@/lib/utils/excel-sync-controller"
// import { createClient } from "@/lib/supabase/client"

export async function fetchInvoices() {
  try {
    const res = await fetch("/api/excel/invoices");
    if (!res.ok) throw new Error("Failed to fetch invoices from Excel API");
    const { invoices } = await res.json();
    return invoices || [];
  } catch (e) {
    console.error("[ExcelAPI] fetchInvoices failed:", e);
    throw e;
  }
}

export async function createInvoice(invoiceData: any, items: any[]) {
  try {
    const res = await fetch("/api/excel/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...invoiceData, items }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create invoice in Excel");
    }
    return (await res.json()).invoice;
  } catch (e) {
    console.error("[ExcelAPI] createInvoice failed:", e);
    throw e;
  }
}

export async function updateInvoice(id: string, updates: any) {
  try {
    const res = await fetch("/api/excel/invoices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updates, id }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update invoice in Excel");
    }
    return (await res.json()).invoice;
  } catch (e) {
    console.error("[ExcelAPI] updateInvoice failed:", e);
    throw e;
  }
}

export async function deleteInvoice(id: string) {
  try {
    const res = await fetch("/api/excel/invoices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to delete invoice in Excel");
    }
    return (await res.json()).success;
  } catch (e) {
    console.error("[ExcelAPI] deleteInvoice failed:", e);
    throw e;
  }
}
