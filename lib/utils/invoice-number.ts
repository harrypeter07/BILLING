import { db } from "@/lib/dexie-client"

/**
 * Generates invoice number in format: STORE4-EMP4-YYYYMMDDHHmmss-SEQ
 * STORE4: First 4 chars of store code
 * EMP4: Employee ID (4-char)
 * YYYYMMDDHHmmss: Current timestamp
 * SEQ: 3-digit daily sequence (000-999) per store, resets at midnight
 */
export async function generateInvoiceNumber(storeId: string, employeeId: string): Promise<string> {
  const store = await db.stores.get(storeId)
  if (!store) throw new Error("Store not found")
  
  const storeCode = store.store_code.toUpperCase().slice(0, 4).padEnd(4, "X")
  const empId = (employeeId || "ADMN").toUpperCase().slice(0, 4).padEnd(4, "X")
  
  // Get current date in YYYYMMDD format
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "") // YYYYMMDD
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "") // HHmmss
  
  // Get or create sequence for today
  const sequenceKey = `${storeId}-${dateStr}`
  let sequence = await db.invoice_sequences.get(sequenceKey)
  
  if (!sequence) {
    // First invoice of the day
    sequence = {
      id: sequenceKey,
      store_id: storeId,
      date: dateStr,
      sequence: 0,
    }
  }
  
  // Increment sequence
  sequence.sequence += 1
  if (sequence.sequence > 999) {
    throw new Error("Daily invoice limit reached (999)")
  }
  
  await db.invoice_sequences.put(sequence)
  
  const seqStr = String(sequence.sequence).padStart(3, "0")
  
  return `${storeCode}-${empId}-${dateStr}${timeStr}-${seqStr}`
}

