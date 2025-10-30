// Database type definitions for TypeScript
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          username: string | null
          full_name: string | null
          business_name: string | null
          business_gstin: string | null
          business_phone: string | null
          business_address: string | null
          logo_url: string | null
          theme_preference: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          full_name?: string | null
          business_name?: string | null
          business_gstin?: string | null
          business_phone?: string | null
          business_address?: string | null
          logo_url?: string | null
          theme_preference?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          full_name?: string | null
          business_name?: string | null
          business_gstin?: string | null
          business_phone?: string | null
          business_address?: string | null
          logo_url?: string | null
          theme_preference?: string
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          sku: string | null
          category: string | null
          price: number
          cost_price: number | null
          stock_quantity: number
          unit: string
          hsn_code: string | null
          gst_rate: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          sku?: string | null
          category?: string | null
          price: number
          cost_price?: number | null
          stock_quantity?: number
          unit?: string
          hsn_code?: string | null
          gst_rate?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          sku?: string | null
          category?: string | null
          price?: number
          cost_price?: number | null
          stock_quantity?: number
          unit?: string
          hsn_code?: string | null
          gst_rate?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string | null
          phone: string | null
          gstin: string | null
          billing_address: string | null
          shipping_address: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          email?: string | null
          phone?: string | null
          gstin?: string | null
          billing_address?: string | null
          shipping_address?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          gstin?: string | null
          billing_address?: string | null
          shipping_address?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          user_id: string
          customer_id: string | null
          invoice_number: string
          invoice_date: string
          due_date: string | null
          status: "draft" | "sent" | "paid" | "cancelled"
          is_gst_invoice: boolean
          subtotal: number
          discount_amount: number
          cgst_amount: number
          sgst_amount: number
          igst_amount: number
          total_amount: number
          notes: string | null
          terms: string | null
          is_synced: boolean
          last_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          customer_id?: string | null
          invoice_number: string
          invoice_date?: string
          due_date?: string | null
          status?: "draft" | "sent" | "paid" | "cancelled"
          is_gst_invoice?: boolean
          subtotal?: number
          discount_amount?: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          total_amount?: number
          notes?: string | null
          terms?: string | null
          is_synced?: boolean
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          customer_id?: string | null
          invoice_number?: string
          invoice_date?: string
          due_date?: string | null
          status?: "draft" | "sent" | "paid" | "cancelled"
          is_gst_invoice?: boolean
          subtotal?: number
          discount_amount?: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          total_amount?: number
          notes?: string | null
          terms?: string | null
          is_synced?: boolean
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          product_id: string | null
          description: string
          quantity: number
          unit_price: number
          discount_percent: number
          gst_rate: number
          hsn_code: string | null
          line_total: number
          gst_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          product_id?: string | null
          description: string
          quantity: number
          unit_price: number
          discount_percent?: number
          gst_rate?: number
          hsn_code?: string | null
          line_total: number
          gst_amount?: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          product_id?: string | null
          description?: string
          quantity?: number
          unit_price?: number
          discount_percent?: number
          gst_rate?: number
          hsn_code?: string | null
          line_total?: number
          gst_amount?: number
          created_at?: string
        }
      }
      business_settings: {
        Row: {
          id: string
          user_id: string
          invoice_prefix: string
          next_invoice_number: number
          default_due_days: number
          default_gst_rate: number
          place_of_supply: string | null
          currency_symbol: string
          date_format: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          invoice_prefix?: string
          next_invoice_number?: number
          default_due_days?: number
          default_gst_rate?: number
          place_of_supply?: string | null
          currency_symbol?: string
          date_format?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          invoice_prefix?: string
          next_invoice_number?: number
          default_due_days?: number
          default_gst_rate?: number
          place_of_supply?: string | null
          currency_symbol?: string
          date_format?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
