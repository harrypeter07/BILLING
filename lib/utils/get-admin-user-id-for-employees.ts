/**
 * Utility to get admin user_id for employees or return current user's id for admins
 * This is needed because employees don't have Supabase auth sessions
 */

import { createClient } from "@/lib/supabase/client"

/**
 * Gets the admin user_id for invoice creation
 * - For employees: Returns their store's admin_user_id
 * - For admins: Returns their own user_id
 * 
 * This ensures invoices are always created with the correct user_id
 * that matches the RLS policy requirements.
 */
export async function getAdminUserIdForInvoices(): Promise<string | null> {
  const supabase = createClient()
  
  // Check if employee session exists
  const authType = typeof window !== 'undefined' ? localStorage.getItem("authType") : null
  if (authType === "employee") {
    const employeeSession = typeof window !== 'undefined' ? localStorage.getItem("employeeSession") : null
    if (employeeSession) {
      try {
        const session = JSON.parse(employeeSession)
        const storeId = session.storeId || (typeof window !== 'undefined' ? localStorage.getItem("currentStoreId") : null)
        const employeeId = session.employeeId || session.employee_id
        
        if (!storeId) {
          console.error("[getAdminUserIdForInvoices] Employee session missing storeId", { session })
          return null
        }
        
        // Get admin_user_id from store
        const { data: store, error: storeError } = await supabase
          .from("stores")
          .select("admin_user_id, name")
          .eq("id", storeId)
          .maybeSingle()
        
        if (storeError) {
          console.error("[getAdminUserIdForInvoices] Error fetching store:", storeError)
          return null
        }
        
        if (!store || !store.admin_user_id) {
          console.error("[getAdminUserIdForInvoices] Store not found or missing admin_user_id", { storeId, store })
          return null
        }
        
        console.log("[getAdminUserIdForInvoices] Employee invoice - using admin user_id:", {
          employeeId,
          storeId,
          storeName: store.name,
          adminUserId: store.admin_user_id
        })
        
        return store.admin_user_id
      } catch (e) {
        console.error("[getAdminUserIdForInvoices] Error parsing employee session:", e)
        return null
      }
    }
    
    console.warn("[getAdminUserIdForInvoices] Employee authType but no employeeSession found")
    return null
  }
  
  // Check if admin user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError) {
    console.error("[getAdminUserIdForInvoices] Error getting user:", userError)
    return null
  }
  
  if (user) {
    // Check if this user is admin
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    
    if (profileError) {
      console.error("[getAdminUserIdForInvoices] Error fetching profile:", profileError)
      // Still return user.id if profile fetch fails (might be admin)
      return user.id
    }
    
    if (profile?.role === "admin") {
      console.log("[getAdminUserIdForInvoices] Admin invoice - using own user_id:", user.id)
      return user.id
    } else {
      console.warn("[getAdminUserIdForInvoices] User is not admin:", { userId: user.id, role: profile?.role })
    }
  }
  
  console.warn("[getAdminUserIdForInvoices] No valid user or admin found")
  return null
}


