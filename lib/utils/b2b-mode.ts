"use client"

import { createClient } from "@/lib/supabase/client"
import { isIndexedDbMode } from "./db-mode"
import { db } from "@/lib/dexie-client"

/**
 * B2B Mode Configuration Interface
 */
export interface B2BModeConfig {
  allowB2BMode: boolean // Admin's master switch
  isB2BEnabled: boolean // Admin's or Employee's active B2B mode
  isAdmin: boolean
}

/**
 * Get admin user_id for current user (employee or admin)
 */
async function getAdminUserId(): Promise<string | null> {
  const supabase = createClient()
  
  // Check if employee session exists
  const authType = localStorage.getItem("authType")
  if (authType === "employee") {
    const employeeSession = localStorage.getItem("employeeSession")
    if (employeeSession) {
      try {
        const session = JSON.parse(employeeSession)
        const storeId = session.storeId || localStorage.getItem("currentStoreId")
        if (storeId) {
          // Get admin_user_id from store
          const { data: store } = await supabase
            .from("stores")
            .select("admin_user_id")
            .eq("id", storeId)
            .single()
          return store?.admin_user_id || null
        }
      } catch (e) {
        console.error("[getAdminUserId] Error parsing employee session:", e)
      }
    }
  }
  
  // Check if admin user
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    // Check if this user is admin
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    
    if (profile?.role === "admin") {
      return user.id
    }
  }
  
  return null
}

/**
 * Get B2B Mode Configuration
 * 
 * For Admin: Returns admin's allow_b2b_mode and is_b2b_enabled
 * For Employee: Returns admin's allow_b2b_mode and employee's personal employee_b2b_mode
 */
export async function getB2BModeConfig(): Promise<B2BModeConfig> {
  try {
    const supabase = createClient()
    
    // Get admin user_id (works for both admin and employees)
    const adminUserId = await getAdminUserId()
    if (!adminUserId) {
      return { allowB2BMode: false, isB2BEnabled: false, isAdmin: false }
    }
    
    // Check if current user is admin
    const { data: { user } } = await supabase.auth.getUser()
    const isAdmin = !!user && user.id === adminUserId
    
    // Check employee session
    const authType = localStorage.getItem("authType")
    const isEmployeeSession = authType === "employee"
    
    // Get admin's business_settings
    // Use maybeSingle() to handle case where settings don't exist
    const { data: adminSettings, error: settingsError } = await supabase
      .from("business_settings")
      .select("allow_b2b_mode, is_b2b_enabled, database_mode")
      .eq("user_id", adminUserId)
      .maybeSingle()
    
    if (settingsError) {
      console.error("[getB2BModeConfig] Error fetching admin settings:", settingsError)
    }
    
    const allowB2BMode = adminSettings?.allow_b2b_mode || false
    
    // Determine active B2B mode
    let isB2BEnabled = false
    
    if (isAdmin || !isEmployeeSession) {
      // Admin uses admin's is_b2b_enabled
      isB2BEnabled = adminSettings?.is_b2b_enabled || false
    } else {
      // Employee uses their personal employee_b2b_mode (if admin allows)
      // If employee hasn't set a preference, default to admin's mode
      if (allowB2BMode) {
        // Try to get employee's profile if they have Supabase auth
        if (user) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("employee_b2b_mode")
            .eq("id", user.id)
            .maybeSingle()
          
          // If employee has set a preference, use it; otherwise default to admin's mode
          if (profile?.employee_b2b_mode !== null && profile?.employee_b2b_mode !== undefined) {
            isB2BEnabled = profile.employee_b2b_mode
          } else {
            // Employee hasn't set preference, use admin's mode as default
            isB2BEnabled = adminSettings?.is_b2b_enabled || false
          }
        } else {
          // Employee without Supabase auth - check localStorage or default to admin's mode
          try {
            const employeeSession = localStorage.getItem("employeeSession")
            if (employeeSession) {
              const session = JSON.parse(employeeSession)
              if (session.employeeB2BMode !== null && session.employeeB2BMode !== undefined) {
                isB2BEnabled = session.employeeB2BMode
              } else {
                isB2BEnabled = adminSettings?.is_b2b_enabled || false
              }
            } else {
              isB2BEnabled = adminSettings?.is_b2b_enabled || false
            }
          } catch (e) {
            console.error("[getB2BModeConfig] Error parsing employee session:", e)
            isB2BEnabled = adminSettings?.is_b2b_enabled || false
          }
        }
      } else {
        // Admin hasn't allowed B2B, force B2C
        isB2BEnabled = false
      }
    }
    
    return {
      allowB2BMode,
      isB2BEnabled,
      isAdmin: isAdmin && !isEmployeeSession,
    }
  } catch (error) {
    console.error("[getB2BModeConfig] Error fetching B2B config:", error)
    return { allowB2BMode: false, isB2BEnabled: false, isAdmin: false }
  }
}

/**
 * B2B Mode Detection Utility (Legacy - use getB2BModeConfig instead)
 * 
 * Fetches B2B mode status considering admin permissions and employee preferences
 */
export async function getB2BModeStatus(): Promise<boolean> {
  const config = await getB2BModeConfig()
  return config.isB2BEnabled
}

/**
 * Check if B2B toggle should be visible to current user
 */
export async function canToggleB2B(): Promise<boolean> {
  const config = await getB2BModeConfig()
  return config.allowB2BMode
}

