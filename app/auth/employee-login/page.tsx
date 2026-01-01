"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { db } from "@/lib/dexie-client"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function EmployeeLoginPage() {
  const [employeeId, setEmployeeId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const hasCheckedSession = useRef(false)

  // Check if already logged in and redirect (prevent loops)
  useEffect(() => {
    // Only check once on mount
    if (hasCheckedSession.current) return
    hasCheckedSession.current = true

    const checkExistingSession = () => {
      const authType = localStorage.getItem("authType")
      if (authType === "employee") {
        const employeeSession = localStorage.getItem("employeeSession")
        if (employeeSession) {
          try {
            const session = JSON.parse(employeeSession)
            if (session.employeeId && session.storeId) {
              // Already logged in, redirect to invoice creation
              router.push("/invoices/new")
              return
            }
          } catch (e) {
            // Invalid session, clear it
            localStorage.removeItem("employeeSession")
            localStorage.removeItem("authType")
            localStorage.removeItem("currentStoreId")
          }
        }
      }
    }

    checkExistingSession()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // Validate input
      if (!employeeId || !employeeId.trim()) {
        throw new Error("Please enter your Employee ID")
      }

      if (!password || !password.trim()) {
        throw new Error("Please enter your password")
      }

      // ALWAYS check Supabase for employee credentials
      // Employees are always stored in Supabase for remote device login
      const upperEmployeeId = employeeId.toUpperCase().trim()
      const trimmedPassword = password.trim()

      console.log("[EmployeeLogin] Attempting login:", {
        employee_id: upperEmployeeId,
        password_length: trimmedPassword.length
      })

      // Find employee by employee_id only (no store required)
      const employeeResponse = await fetch('/api/employees/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: upperEmployeeId
          // No store_id - find employee by ID only
        })
      })

      if (!employeeResponse.ok) {
        const errorData = await employeeResponse.json()
        throw new Error(
          errorData.error ||
          `Employee "${upperEmployeeId}" not found.\n\n` +
          `Please verify your Employee ID is correct.`
        )
      }

      const employeeData = await employeeResponse.json()

      if (!employeeData.employee) {
        throw new Error(
          `Employee "${upperEmployeeId}" not found.\n\n` +
          `Please verify your Employee ID is correct.`
        )
      }

      const employee = employeeData.employee

      // Debug logging
      console.log("[EmployeeLogin] Employee found:", {
        employee_id: employee.employee_id,
        name: employee.name,
        has_password: !!employee.password,
        password_length: employee.password?.length || 0,
        is_active: employee.is_active,
        store_id: employee.store_id
      })

      // Supabase returns store relationship - handle both array and object formats
      const store = Array.isArray(employee.stores)
        ? employee.stores[0]
        : employee.stores || employee.store

      // Verify employee is active
      if (!employee.is_active) {
        throw new Error("Employee account is inactive. Please contact your administrator.")
      }

      // Check if password field exists
      if (!employee.password) {
        console.error("[EmployeeLogin] Employee password is missing from database")
        throw new Error("Employee password not found in database. Please contact your administrator to reset your password.")
      }

      // Check password - compare with both stored password and employee_id (fallback)
      const passwordMatches = employee.password === trimmedPassword || employee.employee_id === trimmedPassword

      console.log("[EmployeeLogin] Password validation:", {
        provided_password: trimmedPassword,
        stored_password: employee.password,
        employee_id: employee.employee_id,
        password_exact_match: employee.password === trimmedPassword,
        employee_id_match: employee.employee_id === trimmedPassword,
        final_match: passwordMatches
      })

      if (!passwordMatches) {
        throw new Error("Invalid password. Please check your password or try using your Employee ID as password.")
      }

      // Get store info from employee record
      if (!store || !store.id) {
        throw new Error("Employee store information not found. Please contact your administrator.")
      }

      // Create session
      const session = {
        employeeId: employee.employee_id,
        employeeName: employee.name,
        storeId: store.id,
        storeName: store.name || "Unknown Store",
        storeCode: store.store_code || "",
      }
      localStorage.setItem("employeeSession", JSON.stringify(session))
      localStorage.setItem("currentStoreId", store.id)
      localStorage.setItem("authType", "employee")

      // Save session to IndexedDB for offline access
      const { saveAuthSession } = await import("@/lib/utils/auth-session")
      await saveAuthSession({
        userId: employee.id,
        email: employee.email || employee.employee_id,
        role: "employee",
        storeId: store.id,
      })
      console.log("[EmployeeLogin] Session saved to IndexedDB")

      toast.success("Logged in as Employee")
      // Redirect to invoice creation
      setTimeout(() => {
        router.push("/invoices/new")
        router.refresh()
      }, 100)
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
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <CardTitle>Employee Login</CardTitle>
              <CardDescription>
                Enter your employee ID and password to login
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
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
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive whitespace-pre-line">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-center gap-4 pt-2">
              <Link href="/" className="text-xs text-muted-foreground hover:text-primary">
                Home
              </Link>
              <span className="text-xs text-muted-foreground">•</span>
              <Link href="/auth/login" className="text-xs text-muted-foreground hover:text-primary">
                Admin/Public Login
              </Link>
              <span className="text-xs text-muted-foreground">•</span>
              <Link href="/auth/customer-login" className="text-xs text-muted-foreground hover:text-primary">
                Customer Login
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

