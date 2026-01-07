"use client"

// Single primary local DB: IndexedDB (Dexie)
export type DatabaseMode = 'indexeddb' | 'supabase'

/**
 * CENTRALIZED DATABASE MODE DETECTION
 * 
 * This is the SINGLE SOURCE OF TRUTH for database mode.
 * All components must use this function to determine which database to use.
 * 
 * Rules:
 * - Supabase mode: NEVER access IndexedDB
 * - IndexedDB mode: NEVER access Supabase
 * - Hybrid operations are FORBIDDEN
 */
export function getActiveDbMode(): DatabaseMode {
  if (typeof window === 'undefined') return 'indexeddb'
  const v = window.localStorage.getItem('databaseType')
  return v === 'supabase' ? 'supabase' : 'indexeddb'
}

// Backward-compatible alias
export function getDatabaseType(): DatabaseMode {
  return getActiveDbMode()
}

export function isIndexedDbMode() {
  return getActiveDbMode() === 'indexeddb'
}

export function isCloudMode() {
  return getActiveDbMode() === 'supabase'
}

export function forceIndexedDbMode() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('databaseType', 'indexeddb')
}

// Backward-compatible alias for legacy checks (`=== 'excel'`)
export function isExcelMode() {
  return isIndexedDbMode()
}
