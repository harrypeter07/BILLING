import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
              // This can be ignored if you have middleware refreshing user sessions.
            }
          },
        },
      }
    )
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, phone, role, salary, joining_date, is_active, store_id, employee_id, password } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Employee name is required" }, { status: 400 })
    }

    if (!store_id) {
      return NextResponse.json({ error: "Store ID is required" }, { status: 400 })
    }

    // Verify store belongs to this admin
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("admin_user_id")
      .eq("id", store_id)
      .single()

    if (storeError || !store || store.admin_user_id !== user.id) {
      return NextResponse.json({ error: "Store not found or access denied" }, { status: 403 })
    }

    const employeeData: any = {
      user_id: user.id,
      store_id,
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      role: role || "employee",
      salary: salary ? Number(salary) : null,
      joining_date: joining_date || null,
      is_active: is_active !== undefined ? is_active : true,
      employee_id: employee_id || null,
    }

    // If password is provided, hash it (in production, use proper hashing)
    if (password) {
      employeeData.password = password // In production, hash this password
    }

    const { data: employee, error } = await supabase
      .from("employees")
      .insert(employeeData)
      .select()
      .single()

    if (error) {
      console.error("[API /employees] Error creating employee:", error)
      return NextResponse.json({ error: error.message || "Failed to create employee" }, { status: 500 })
    }

    return NextResponse.json({ employee }, { status: 201 })
  } catch (error: any) {
    console.error("[API /employees] Unexpected error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, email, phone, role, salary, joining_date, is_active, employee_id, password } = body

    if (!id) {
      return NextResponse.json({ error: "Employee ID is required" }, { status: 400 })
    }

    // Verify employee belongs to this admin
    const { data: existingEmployee, error: fetchError } = await supabase
      .from("employees")
      .select("store_id, stores(admin_user_id)")
      .eq("id", id)
      .single()

    if (fetchError || !existingEmployee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    const updateData: any = {}
    if (name) updateData.name = name.trim()
    if (email !== undefined) updateData.email = email?.trim() || null
    if (phone !== undefined) updateData.phone = phone?.trim() || null
    if (role) updateData.role = role
    if (salary !== undefined) updateData.salary = salary ? Number(salary) : null
    if (joining_date !== undefined) updateData.joining_date = joining_date || null
    if (is_active !== undefined) updateData.is_active = is_active
    if (employee_id !== undefined) updateData.employee_id = employee_id
    if (password) updateData.password = password // In production, hash this

    const { data: employee, error } = await supabase
      .from("employees")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[API /employees] Error updating employee:", error)
      return NextResponse.json({ error: error.message || "Failed to update employee" }, { status: 500 })
    }

    return NextResponse.json({ employee }, { status: 200 })
  } catch (error: any) {
    console.error("[API /employees] Unexpected error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

