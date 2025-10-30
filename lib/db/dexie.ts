import Dexie, { type EntityTable } from "dexie"

// Database interfaces matching Supabase schema
export interface Product {
  id: string
  user_id: string
  name: string
  description?: string | null
  sku?: string | null
  category?: string | null
  price: number
  cost_price?: number | null
  stock_quantity: number
  unit: string
  hsn_code?: string | null
  gst_rate: number
  is_active: boolean
  created_at: string
  updated_at: string
  is_synced: boolean
  deleted: boolean
}

export interface Customer {
  id: string
  user_id: string
  name: string
  email?: string | null
  phone?: string | null
  gstin?: string | null
  billing_address?: string | null
  shipping_address?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  is_synced: boolean
  deleted: boolean
}

export interface Invoice {
  id: string
  user_id: string
  customer_id?: string | null
  invoice_number: string
  invoice_date: string
  due_date?: string | null
  status: string
  is_gst_invoice: boolean
  subtotal: number
  discount_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
  notes?: string | null
  terms?: string | null
  created_at: string
  updated_at: string
  is_synced: boolean
  deleted: boolean
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  product_id?: string | null
  description: string
  quantity: number
  unit_price: number
  discount_percent: number
  gst_rate: number
  hsn_code?: string | null
  line_total: number
  gst_amount: number
  created_at: string
}

export interface SyncQueue {
  id?: number
  entity_type: "product" | "customer" | "invoice"
  entity_id: string
  action: "create" | "update" | "delete"
  data: any
  created_at: string
  retry_count: number
}

// Dexie database class
class BillingDatabase extends Dexie {
  products!: EntityTable<Product, "id">
  customers!: EntityTable<Customer, "id">
  invoices!: EntityTable<Invoice, "id">
  invoice_items!: EntityTable<InvoiceItem, "id">
  sync_queue!: EntityTable<SyncQueue, "id">

  constructor() {
    super("BillingDatabase")

    this.version(1).stores({
      products: "id, user_id, name, is_synced, deleted",
      customers: "id, user_id, name, is_synced, deleted",
      invoices: "id, user_id, customer_id, invoice_number, invoice_date, is_synced, deleted",
      invoice_items: "id, invoice_id, product_id",
      sync_queue: "++id, entity_type, entity_id, created_at",
    })
  }
}

export const db = new BillingDatabase()
