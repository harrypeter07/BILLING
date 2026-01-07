"use client"

// Single primary local DB: IndexedDB (Dexie)
export type DatabaseMode = 'indexeddb' | 'supabase'

// Cache for admin's database mode (for employees)
let cachedAdminDbMode: DatabaseMode | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 2000 // 2 seconds (shorter for real-time sync)

/**
 * Clear the database mode cache (call when admin switches modes)
 */
export function clearDatabaseModeCache(): void {
  cachedAdminDbMode = null
  cacheTimestamp = 0
}

/**
 * Get admin's database mode from business_settings
 */
async function getAdminDatabaseMode(): Promise<DatabaseMode> {
  // Use cache if recent
  const now = Date.now()
  if (cachedAdminDbMode && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedAdminDbMode
  }

  try {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()

    // Check if employee session
    const authType = typeof window !== 'undefined' ? localStorage.getItem("authType") : null
    if (authType === "employee") {
      const employeeSession = typeof window !== 'undefined' ? localStorage.getItem("employeeSession") : null
      if (employeeSession) {
        try {
          const session = JSON.parse(employeeSession)
          const storeId = session.storeId || (typeof window !== 'undefined' ? localStorage.getItem("currentStoreId") : null)
          if (storeId) {
            // Get admin_user_id from store
            const { data: store } = await supabase
              .from("stores")
              .select("admin_user_id")
              .eq("id", storeId)
              .single()

            if (store?.admin_user_id) {
              // Get admin's database_mode from business_settings
              // Use maybeSingle() to handle case where settings don't exist
              const { data: settings, error: settingsError } = await supabase
                .from("business_settings")
                .select("database_mode")
                .eq("user_id", store.admin_user_id)
                .maybeSingle()

              if (settingsError) {
                console.error("[getAdminDatabaseMode] Error fetching admin settings:", settingsError)
              }

              const mode = (settings?.database_mode as DatabaseMode) || 'indexeddb'
              cachedAdminDbMode = mode
              cacheTimestamp = now
              return mode
            }
          }
        } catch (e) {
          console.error("[getAdminDatabaseMode] Error:", e)
        }
      }
    }

    // For admin users, check their own settings
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: settings, error: settingsError } = await supabase
        .from("business_settings")
        .select("database_mode")
        .eq("user_id", user.id)
        .maybeSingle()

      if (settingsError) {
        console.error("[getAdminDatabaseMode] Error fetching admin settings:", settingsError)
      }

      const mode = (settings?.database_mode as DatabaseMode) || 'indexeddb'
      cachedAdminDbMode = mode
      cacheTimestamp = now
      return mode
    }
  } catch (error) {
    console.error("[getAdminDatabaseMode] Error fetching admin DB mode:", error)
  }

  // Fallback to localStorage or default
  if (typeof window !== 'undefined') {
    const v = window.localStorage.getItem('databaseType')
    return v === 'supabase' ? 'supabase' : 'indexeddb'
  }
  return 'indexeddb'
}

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
 * - Employees inherit database mode from admin (via business_settings)
 */
export async function getActiveDbModeAsync(): Promise<DatabaseMode> {
  if (typeof window === 'undefined') return 'indexeddb'
  
  // Check if employee session
  const authType = localStorage.getItem("authType")
  if (authType === "employee") {
    // Employee: inherit from admin
    return await getAdminDatabaseMode()
  }

  // Admin: use localStorage (and sync to business_settings)
  const v = localStorage.getItem('databaseType')
  const mode = v === 'supabase' ? 'supabase' : 'indexeddb'
  
  // Sync to business_settings (async, non-blocking)
  syncDatabaseModeToSettings(mode).catch(err => {
    console.warn("[getActiveDbModeAsync] Failed to sync DB mode to settings:", err)
  })
  
  return mode
}

/**
 * Sync database mode to business_settings (for admin)
 */
async function syncDatabaseModeToSettings(mode: DatabaseMode): Promise<void> {
  try {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Update business_settings
      await supabase
        .from("business_settings")
        .update({ database_mode: mode })
        .eq("user_id", user.id)
      
      // Clear cache
      cachedAdminDbMode = null
      cacheTimestamp = 0
    }
  } catch (error) {
    // Silently fail - not critical
    console.warn("[syncDatabaseModeToSettings] Error:", error)
  }
}

/**
 * Synchronous version (for compatibility)
 * Falls back to localStorage check if employee (may be stale)
 */
export function getActiveDbMode(): DatabaseMode {
  if (typeof window === 'undefined') return 'indexeddb'
  
  // Check if employee - use cached admin mode if available
  const authType = localStorage.getItem("authType")
  if (authType === "employee" && cachedAdminDbMode) {
    return cachedAdminDbMode
  }
  
  // For admin or if cache not available, use localStorage
  const v = localStorage.getItem('databaseType')
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
