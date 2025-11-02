"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { db } from "@/lib/dexie-client"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function EmployeeLoginPage() {
  const [storeName, setStoreName] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const isExcel = getDatabaseType() === 'excel'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // ALWAYS check Supabase FIRST for employee credentials
      // This ensures login works from remote devices and incognito mode
      const supabase = createClient()
      
      // Try Supabase first (even in Excel mode, employees should be in Supabase)
      try {
        console.log("[EmployeeLogin] Searching for store:", { 
          storeName, 
          storeNameLength: storeName.length,
          storeNameTrimmed: storeName.trim(),
        })
        
        // Find store by name OR store_code (case-insensitive, trimmed)
        const trimmedStoreName = storeName.trim()
        const upperStoreName = trimmedStoreName.toUpperCase()
        
        // Try to find by name (case-insensitive using ilike) OR by store_code (exact match after trimming)
        const { data: stores, error: storeError } = await supabase
          .from("stores")
          .select("*")
          .or(`name.ilike.%${trimmedStoreName}%,store_code.eq.${upperStoreName}`)
          .limit(5) // Get multiple in case of matches to find the best one
        
        if (storeError) {
          console.error("[EmployeeLogin] Error searching for store:", storeError)
          throw new Error(`Store lookup failed: ${storeError.message}`)
        }
        
        console.log("[EmployeeLogin] Store search results:", {
          found: stores?.length || 0,
          stores: stores?.map(s => ({ id: s.id, name: s.name, code: s.store_code }))
        })
        
        // Find exact match by name (case-insensitive) or store_code
        let store = stores?.find(s => 
          s.name.toLowerCase().trim() === trimmedStoreName.toLowerCase() || 
          s.store_code.toUpperCase().trim() === upperStoreName
        )
        
        // If no exact match, try partial name match
        if (!store && stores && stores.length > 0) {
          store = stores[0] // Take first result as fallback
          console.log("[EmployeeLogin] Using first store result:", {
            id: store.id,
            name: store.name,
            code: store.store_code
          })
        }
        
        if (store) {
          console.log("[EmployeeLogin] Store found:", {
            id: store.id,
            name: store.name,
            storeCode: store.store_code,
            adminUserId: store.admin_user_id
          })

          // Verify store belongs to an admin
          if (!store.admin_user_id) {
            throw new Error("Access denied: Store must be created by an admin")
          }

          // Verify the admin_user_id exists and is an admin
          const { data: adminProfile } = await supabase
            .from("user_profiles")
            .select("role")
            .eq("id", store.admin_user_id)
            .maybeSingle()
          
          if (!adminProfile || adminProfile.role !== "admin") {
            throw new Error("Access denied: Store owner is not an admin")
          }

          // Find employee - ensure employee belongs to this store
          const { data: employees, error: empError } = await supabase
            .from("employees")
            .select("*, stores!inner(admin_user_id)")
            .eq("employee_id", employeeId.toUpperCase())
            .eq("store_id", store.id)
          
          if (!empError && employees && employees.length > 0) {
            const employee = employees[0]

            // Verify employee has a valid store_id that matches the store
            if (!employee.store_id || employee.store_id !== store.id) {
              throw new Error("Invalid employee-store association")
            }

            // Check password
            if (employee.password !== password && employee.employee_id !== password) {
              throw new Error("Invalid password")
            }

            // Create session
            const session = {
              employeeId: employee.employee_id,
              employeeName: employee.name,
              storeId: store.id,
              storeName: store.name,
              storeCode: store.store_code,
            }
            localStorage.setItem("employeeSession", JSON.stringify(session))
            localStorage.setItem("currentStoreId", store.id)
            localStorage.setItem("authType", "employee")

            toast.success("Logged in as Employee")
            router.push("/dashboard")
            router.refresh()
            return // Success - exit early
          }
        }
      } catch (supabaseError: any) {
        // Supabase lookup failed - continue to Excel fallback
        console.log("[EmployeeLogin] Supabase lookup failed, trying Excel:", supabaseError.message)
      }

      // Fallback to Excel mode if Supabase didn't work
      if (isExcel) {
        console.log("[EmployeeLogin] Excel mode: Searching for store:", { storeName })
        
        // Find store by name (case-insensitive) OR store_code
        const trimmedStoreName = storeName.trim()
        const upperStoreName = trimmedStoreName.toUpperCase()
        
        // Get all stores and filter
        const allStores = await db.stores.toArray()
        const stores = allStores.filter(s => 
          s.name?.toLowerCase().trim() === trimmedStoreName.toLowerCase() ||
          s.store_code?.toUpperCase().trim() === upperStoreName
        )
        
        console.log("[EmployeeLogin] Excel mode: Store search results:", {
          totalStores: allStores.length,
          matchedStores: stores.length,
          stores: stores.map(s => ({ id: s.id, name: s.name, code: s.store_code }))
        })
        
        if (stores.length === 0) {
          const availableStores = allStores.map(s => ({
            name: s.name,
            code: s.store_code
          }))
          console.error("[EmployeeLogin] Store not found. Available stores:", availableStores)
          throw new Error(
            `Store not found. Please enter the exact Store Name or Store Code.\n` +
            `Available stores: ${availableStores.map(s => `${s.name} (${s.code})`).join(', ')}`
          )
        }
        const store = stores[0]
        
        console.log("[EmployeeLogin] Excel mode: Store found:", {
          id: store.id,
          name: store.name,
          storeCode: store.store_code
        })

        // Verify store belongs to an admin (has admin_user_id or created by admin)
        if (!store.admin_user_id) {
          throw new Error("Access denied: Store must be created by an admin")
        }

        // Find employee by employee_id and store_id - ensure employee belongs to this store
        const employees = await db.employees
          .where("employee_id").equals(employeeId.toUpperCase())
          .and(e => e.store_id === store.id)
          .toArray()
        
        if (employees.length === 0) {
          throw new Error("Employee not found or not associated with this store")
        }
        const employee = employees[0]

        // Verify employee has a valid store_id that matches the store
        if (!employee.store_id || employee.store_id !== store.id) {
          throw new Error("Invalid employee-store association")
        }

        // Check password (simple comparison for now, should hash in production)
        if (employee.password !== password && employee.employee_id !== password) {
          throw new Error("Invalid password")
        }

        // Create session
        const session = {
          employeeId: employee.employee_id,
          employeeName: employee.name,
          storeId: store.id,
          storeName: store.name,
          storeCode: store.store_code,
        }
        localStorage.setItem("employeeSession", JSON.stringify(session))
        localStorage.setItem("currentStoreId", store.id)
        localStorage.setItem("authType", "employee")

        toast.success("Logged in as Employee")
        router.push("/dashboard")
        router.refresh()
      } else {
        // Pure Supabase mode (shouldn't reach here since we checked Supabase first)
        // But keeping as fallback
        throw new Error("Employee not found. Please ensure employee is synced to Supabase.")
      }
    } catch (error: any) {
      setError(error.message || "Login failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Employee Login</CardTitle>
          <CardDescription>Enter your store name, employee ID, and password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="store_name">Store Name or Store Code</Label>
              <Input
                id="store_name"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Enter store name (e.g., 'My Store') or code (e.g., 'MYS1')"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                You can enter either the full store name or the 4-character store code
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee_id">Employee ID</Label>
              <Input
                id="employee_id"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                placeholder="A1B2"
                maxLength={4}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

