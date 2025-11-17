"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getOfflineSession } from "@/lib/utils/offline-auth"

export type UserRole = "admin" | "employee" | "public" | null

export interface UserRoleInfo {
  role: UserRole
  isAdmin: boolean
  isEmployee: boolean
  isPublic: boolean
  isLoading: boolean
  loading?: boolean // Alias for isLoading for backward compatibility
}

export function useUserRole(): UserRoleInfo {
  const [role, setRole] = useState<UserRole>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkRole = async () => {
      setIsLoading(true)
      // Check for employee session first
      const authType = localStorage.getItem("authType")
      if (authType === "employee") {
        setRole("employee")
        setIsLoading(false)
        return
      }

      const offlineSession = getOfflineSession()
      if (offlineSession && !navigator.onLine) {
        setRole(offlineSession.role as UserRole)
        setIsLoading(false)
        return
      }

      // Check for Supabase user
      const supabase = createClient()
      let user = null
      try {
        const { data } = await supabase.auth.getUser()
        user = data.user
      } catch (error) {
        console.warn("[useUserRole] Supabase unavailable:", error)
        if (offlineSession) {
          setRole(offlineSession.role as UserRole)
          setIsLoading(false)
          return
        }
      }
      
      if (!user) {
        setRole(null)
        setIsLoading(false)
        return
      }

      // Get role from user profile
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle() // Use maybeSingle() instead of single() to avoid errors when no rows

      // If profile doesn't exist, default to "admin"
      // This is consistent with middleware and other parts of the codebase
      if (profileError) {
        // Only log non-404 errors (profile missing is expected for new users)
        const isNotFoundError = profileError.code === 'PGRST116' || 
                                profileError.message?.includes('No rows') ||
                                profileError.message?.includes('not found')
        
        if (!isNotFoundError) {
          console.warn("[useUserRole] Error fetching profile:", profileError.message)
        }
      }

      const userRole = (profile?.role as UserRole) || "admin"
      setRole(userRole)
      setIsLoading(false)
    }

    checkRole()
  }, [])

  return {
    role,
    isAdmin: role === "admin",
    isEmployee: role === "employee",
    isPublic: role === "public",
    isLoading,
    loading: isLoading, // Alias for backward compatibility
  }
}

