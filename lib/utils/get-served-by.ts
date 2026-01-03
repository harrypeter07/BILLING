/**
 * Get the name of the person who created/generated the invoice
 * Returns employee name if created by employee, or admin name if created by admin
 */
"use client"

import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { isIndexedDbMode } from "@/lib/utils/db-mode"

export async function getServedByName(invoice: any): Promise<string | undefined> {
  try {
    // Check if invoice was created by an employee
    const employeeId = invoice.created_by_employee_id || invoice.employee_id
    
    if (employeeId) {
      const isIndexedDb = isIndexedDbMode()
      
      if (isIndexedDb) {
        // Get employee from IndexedDB
        const employee = await db.employees
          .where("employee_id")
          .equals(employeeId)
          .first()
        
        if (employee?.name) {
          return employee.name
        }
      } else {
        // Get employee from Supabase
        const supabase = createClient()
        const { data: employee } = await supabase
          .from("employees")
          .select("name")
          .eq("employee_id", employeeId)
          .single()
        
        if (employee?.name) {
          return employee.name
        }
      }
    }
    
    // If no employee, check if created by admin
    const userId = invoice.user_id
    if (userId) {
      const supabase = createClient()
      
      // Try to get admin name from user_profiles
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name, business_name")
        .eq("id", userId)
        .single()
      
      if (profile?.full_name) {
        return profile.full_name
      }
      
      // Fallback to business name or email
      if (profile?.business_name) {
        return profile.business_name
      }
      
      // Last resort: get email from auth.users
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        return user.email.split('@')[0] // Return username part of email
      }
    }
    
    return undefined
  } catch (error) {
    console.warn("[getServedByName] Error fetching creator name:", error)
    return undefined
  }
}

