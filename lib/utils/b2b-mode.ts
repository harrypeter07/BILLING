"use client"

import { createClient } from "@/lib/supabase/client"
import { isIndexedDbMode } from "./db-mode"
import { db } from "@/lib/dexie-client"

/**
 * B2B Mode Detection Utility
 * 
 * Fetches B2B mode status from business_settings
 * Works in both IndexedDB and Supabase modes
 */
export async function getB2BModeStatus(): Promise<boolean> {
  try {
    if (isIndexedDbMode()) {
      // IndexedDB mode - check business_settings
      // Note: business_settings might be in Supabase even in IndexedDB mode
      // For now, try Supabase first (settings are cloud-only)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: settings } = await supabase
          .from("business_settings")
          .select("is_b2b_enabled")
          .eq("user_id", user.id)
          .single()
        return settings?.is_b2b_enabled || false
      }
      return false
    } else {
      // Supabase mode
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      const { data: settings } = await supabase
        .from("business_settings")
        .select("is_b2b_enabled")
        .eq("user_id", user.id)
        .single()

      return settings?.is_b2b_enabled || false
    }
  } catch (error) {
    console.error("[getB2BModeStatus] Error fetching B2B mode:", error)
    return false
  }
}

