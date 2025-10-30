import { createClient } from "@/lib/supabase/client"
import { excelSheetManager } from "@/lib/utils/excel-sync-controller"

export async function fetchProducts() {
  try {
    const res = await fetch("/api/excel/products");
    if (!res.ok) throw new Error("Failed to fetch products from Excel API");
    const { products } = await res.json();
    return products || [];
  } catch (e) {
    console.error("[ExcelAPI] fetchProducts failed:", e);
    throw e;
  }
}

export async function createProduct(productData: any) {
  try {
    const res = await fetch("/api/excel/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create product in Excel");
    }
    return (await res.json()).product;
  } catch (e) {
    console.error("[ExcelAPI] createProduct failed:", e);
    throw e;
  }
}

export async function updateProduct(id: string, updates: any) {
  try {
    const res = await fetch("/api/excel/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updates, id }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update product in Excel");
    }
    return (await res.json()).product;
  } catch (e) {
    console.error("[ExcelAPI] updateProduct failed:", e);
    throw e;
  }
}

export async function deleteProduct(id: string) {
  try {
    const res = await fetch("/api/excel/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to delete product in Excel");
    }
    return (await res.json()).success;
  } catch (e) {
    console.error("[ExcelAPI] deleteProduct failed:", e);
    throw e;
  }
}
