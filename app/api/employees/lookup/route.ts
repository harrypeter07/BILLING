import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    
    // For employee login, we need to bypass RLS to read employee data
    // Use service role key if available, otherwise use anon key
    // The RLS policy should allow reading employees for login purposes
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    // Try to use service role key if available (bypasses RLS)
    // Otherwise use anon key (subject to RLS policies)
    let supabaseKey = supabaseAnonKey
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    }
    
    // Create supabase client
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {
              // The "setAll" method was called from a Server Component/API route.
            }
          },
        },
      }
    )
    
    const body = await request.json()
    const { employee_id, store_id } = body

    if (!employee_id || !employee_id.trim()) {
      return NextResponse.json({ error: "Employee ID is required" }, { status: 400 })
    }

    const upperEmployeeId = employee_id.toUpperCase().trim()

    // Find employee by employee_id (and optionally store_id if provided)
    // Explicitly select password field to ensure it's returned
    let query = supabase
      .from("employees")
      .select(`
        id,
        name,
        email,
        phone,
        role,
        salary,
        joining_date,
        is_active,
        employee_id,
        password,
        store_id,
        user_id,
        created_at,
        updated_at,
        stores (
          id,
          name,
          store_code,
          admin_user_id
        )
      `)
      .eq("employee_id", upperEmployeeId)
      .eq("is_active", true)

    // If store_id is provided, filter by it
    if (store_id) {
      query = query.eq("store_id", store_id)
    }

    const { data: employee, error } = await query.single()

    if (error) {
      console.error("[API /employees/lookup] Supabase error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      
      // Handle specific Supabase errors
      if (error.code === 'PGRST116') {
        // No rows returned
        return NextResponse.json(
          { error: `Employee "${upperEmployeeId}" not found. Please verify your Employee ID.` },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { error: `Failed to lookup employee: ${error.message}` },
        { status: 404 }
      )
    }

    if (!employee) {
      return NextResponse.json(
        { error: `Employee "${upperEmployeeId}" not found. Please verify your Employee ID.` },
        { status: 404 }
      )
    }

    // Validate that password exists
    if (!employee.password) {
      console.error("[API /employees/lookup] Employee found but password is missing:", {
        id: employee.id,
        employee_id: employee.employee_id,
        name: employee.name
      })
      return NextResponse.json(
        { error: "Employee password not found in database. Please contact your administrator." },
        { status: 500 }
      )
    }

    // Log for debugging (without exposing actual password)
    console.log("[API /employees/lookup] Found employee:", {
      id: employee.id,
      employee_id: employee.employee_id,
      name: employee.name,
      has_password: !!employee.password,
      password_length: employee.password?.length || 0,
      store_id: employee.store_id,
      is_active: employee.is_active
    })

    // Return employee with store info (password included for validation)
    return NextResponse.json({ employee }, { status: 200 })
  } catch (error: any) {
    console.error("[API /employees/lookup] Unexpected error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

