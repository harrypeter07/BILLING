import { db } from "@/lib/dexie-client"

/**
 * Generates a unique 4-character employee ID for a given store
 * Format: First 2 chars of store_code + 2-digit sequential number (01-99)
 * Or: First 3 chars of employee name + 1 digit if sequential unavailable
 */
export async function generateEmployeeId(storeId: string, employeeName: string): Promise<string> {
  const store = await db.stores.get(storeId)
  if (!store) throw new Error("Store not found")

  const storeCode = store.store_code.toUpperCase().slice(0, 2).padEnd(2, "X")
  
  // Try sequential: STORE_CODE + 01, 02, ... 99
  for (let i = 1; i <= 99; i++) {
    const candidate = `${storeCode}${String(i).padStart(2, "0")}`
    const existing = await db.employees.where("employee_id").equals(candidate).and(e => e.store_id === storeId).first()
    if (!existing) return candidate
  }
  
  // Fallback: First 3 chars of name + 1 digit
  const namePart = employeeName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3).padEnd(3, "X")
  for (let i = 0; i <= 9; i++) {
    const candidate = `${namePart}${i}`
    const existing = await db.employees.where("employee_id").equals(candidate).and(e => e.store_id === storeId).first()
    if (!existing) return candidate
  }
  
  // Last resort: random 4-char alphanumeric
  return Math.random().toString(36).substring(2, 6).toUpperCase()
}

