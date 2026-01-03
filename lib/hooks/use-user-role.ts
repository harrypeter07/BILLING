"use client"

import { useEffect, useState, useRef } from "react"
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

// Global cache for user role to avoid repeated API calls
let globalRoleCache: { role: UserRole; timestamp: number } | null = null
const ROLE_CACHE_DURATION = 60000 // Cache for 1 minute

export function useUserRole(): UserRoleInfo {
  const [role, setRole] = useState<UserRole>(null)
  const [isLoading, setIsLoading] = useState(true)
  const hasCheckedRef = useRef(false)

  useEffect(() => {
    // Skip if already checked in this session
    if (hasCheckedRef.current) {
      return
    }

    const checkRole = async () => {
      // Check global cache first
      if (globalRoleCache) {
        const age = Date.now() - globalRoleCache.timestamp
        if (age < ROLE_CACHE_DURATION) {
          setRole(globalRoleCache.role)
          setIsLoading(false)
          hasCheckedRef.current = true
          return
        }
      }

      setIsLoading(true)
      
      // Check for employee session first (fastest check)
      const authType = localStorage.getItem("authType")
      if (authType === "employee") {
        const employeeRole: UserRole = "employee"
        setRole(employeeRole)
        setIsLoading(false)
        globalRoleCache = { role: employeeRole, timestamp: Date.now() }
        hasCheckedRef.current = true
        return
      }

      const offlineSession = getOfflineSession()
      if (offlineSession && !navigator.onLine) {
        const offlineRole = offlineSession.role as UserRole
        setRole(offlineRole)
        setIsLoading(false)
        globalRoleCache = { role: offlineRole, timestamp: Date.now() }
        hasCheckedRef.current = true
        return
      }

      // Check for Supabase user (async, but cached)
      const supabase = createClient()
      let user = null
      try {
        const { data } = await supabase.auth.getUser()
        user = data.user
      } catch (error) {
        console.warn("[useUserRole] Supabase unavailable:", error)
        if (offlineSession) {
          const offlineRole = offlineSession.role as UserRole
          setRole(offlineRole)
          setIsLoading(false)
          globalRoleCache = { role: offlineRole, timestamp: Date.now() }
          hasCheckedRef.current = true
          return
        }
      }
      
      if (!user) {
        setRole(null)
        setIsLoading(false)
        globalRoleCache = { role: null, timestamp: Date.now() }
        hasCheckedRef.current = true
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
      globalRoleCache = { role: userRole, timestamp: Date.now() }
      hasCheckedRef.current = true
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

