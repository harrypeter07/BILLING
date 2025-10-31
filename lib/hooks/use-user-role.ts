"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export type UserRole = "admin" | "employee" | "public" | null

export interface UserRoleInfo {
  role: UserRole
  isAdmin: boolean
  isEmployee: boolean
  isPublic: boolean
  isLoading: boolean
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

      // Check for Supabase user
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setRole(null)
        setIsLoading(false)
        return
      }

      // Get role from user profile
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single()

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
  }
}

