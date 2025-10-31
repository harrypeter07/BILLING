import Dexie, { type Table } from "dexie"

export interface Product { id: string; name: string; sku?: string; category?: string; price: number; cost_price?: number; stock_quantity?: number; unit?: string; hsn_code?: string; gst_rate?: number; is_active?: boolean }
export interface Customer { id: string; name: string; email?: string|null; phone?: string|null; gstin?: string|null; billing_address?: string|null; shipping_address?: string|null; notes?: string|null }
export interface Invoice { id: string; customer_id: string; invoice_number: string; invoice_date: string; status: string; is_gst_invoice: boolean; subtotal: number; cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number; notes?: string; terms?: string; created_at: string }
export interface StoreSettings { id: string; invoice_prefix?: string; next_invoice_number?: number }

export class AppDB extends Dexie {
  products!: Table<Product>
  customers!: Table<Customer>
  invoices!: Table<Invoice>
  settings!: Table<StoreSettings>
  fsHandles!: Table<any>

  constructor() {
    super("AppDB_v1")
    this.version(1).stores({
      products: "id",
      customers: "id",
      invoices: "id, created_at",
      settings: "id",
      fsHandles: "key",
    })
  }
}

export const db = new AppDB()


