import { excelSheetManager } from "@/lib/utils/excel-sync-controller"
// Only import Supabase when needed
// import { createClient } from "@/lib/supabase/client"

export async function fetchCustomers() {
  try {
    const res = await fetch("/api/excel/customers");
    if (!res.ok) throw new Error("Failed to fetch customers from Excel API");
    const { customers } = await res.json();
    return customers || [];
  } catch (e) {
    console.error("[ExcelAPI] fetchCustomers failed:", e);
    throw e;
  }
}

export async function createCustomer(customerData: any) {
  try {
    const res = await fetch("/api/excel/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(customerData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create customer in Excel");
    }
    return (await res.json()).customer;
  } catch (e) {
    console.error("[ExcelAPI] createCustomer failed:", e);
    throw e;
  }
}

export async function updateCustomer(id: string, updates: any) {
  try {
    const res = await fetch("/api/excel/customers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updates, id }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update customer in Excel");
    }
    return (await res.json()).customer;
  } catch (e) {
    console.error("[ExcelAPI] updateCustomer failed:", e);
    throw e;
  }
}

export async function deleteCustomer(id: string) {
  try {
    const res = await fetch("/api/excel/customers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to delete customer in Excel");
    }
    return (await res.json()).success;
  } catch (e) {
    console.error("[ExcelAPI] deleteCustomer failed:", e);
    throw e;
  }
}
