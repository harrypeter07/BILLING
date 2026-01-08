/**
 * Save invoice storage metadata to database
 * 
 * Stores R2 metadata (not binary data) in both Supabase and IndexedDB
 */

import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/dexie'
import { isIndexedDbMode } from './db-mode'

export interface InvoiceStorageData {
  invoice_id: string
  r2_object_key: string
  public_url: string
  expires_at: string // ISO date string
}

/**
 * Save invoice storage metadata
 */
export async function saveInvoiceStorage(
  data: InvoiceStorageData
): Promise<{ success: boolean; error?: string }> {
  try {
    const isIndexedDb = isIndexedDbMode()

    if (isIndexedDb) {
      // Save to IndexedDB
      await db.invoice_storage.put({
        id: crypto.randomUUID(),
        invoice_id: data.invoice_id,
        r2_object_key: data.r2_object_key,
        public_url: data.public_url,
        expires_at: data.expires_at,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    } else {
      // Save to Supabase (if table exists)
      const supabase = createClient()
      const { error } = await supabase.from('invoice_storage').insert({
        invoice_id: data.invoice_id,
        r2_object_key: data.r2_object_key,
        public_url: data.public_url,
        expires_at: data.expires_at,
      })

      // If table doesn't exist, just log and continue (non-critical)
      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
          console.warn('[SaveInvoiceStorage] invoice_storage table does not exist. Skipping metadata save. This is non-critical.')
          return { success: true } // Return success since R2 upload already succeeded
        }
        throw error
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error('[SaveInvoiceStorage] Error:', error)
    return {
      success: false,
      error: error.message || 'Failed to save invoice storage metadata',
    }
  }
}

/**
 * Get invoice storage metadata by invoice ID
 */
export async function getInvoiceStorage(
  invoiceId: string
): Promise<InvoiceStorageData | null> {
  try {
    const isIndexedDb = isIndexedDbMode()

    if (isIndexedDb) {
      const storage = await db.invoice_storage
        .where('invoice_id')
        .equals(invoiceId)
        .first()
      
      if (!storage) return null

      return {
        invoice_id: storage.invoice_id,
        r2_object_key: storage.r2_object_key,
        public_url: storage.public_url,
        expires_at: storage.expires_at,
      }
    } else {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('invoice_storage')
        .select('*')
        .eq('invoice_id', invoiceId)
        .maybeSingle()

      // If table doesn't exist, return null (non-critical)
      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
          return null
        }
        console.error('[GetInvoiceStorage] Error:', error)
        return null
      }
      
      if (!data) return null

      return {
        invoice_id: data.invoice_id,
        r2_object_key: data.r2_object_key,
        public_url: data.public_url,
        expires_at: data.expires_at,
      }
    }
  } catch (error: any) {
    console.error('[GetInvoiceStorage] Error:', error)
    return null
  }
}

