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
    const { name, email, phone, gstin, user_id } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 })
    }

    // Use provided user_id (for employees) or current user's id (for admins)
    const targetUserId = user_id || user.id

    const { data: customer, error } = await supabase
      .from("customers")
      .insert({
        user_id: targetUserId,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        gstin: gstin?.trim() || null,
        billing_address: null,
        shipping_address: null,
        notes: null,
      })
      .select()
      .single()

    if (error) {
      console.error("[API /customers] Error creating customer:", error)
      return NextResponse.json({ error: error.message || "Failed to create customer" }, { status: 500 })
    }

    return NextResponse.json({ customer }, { status: 201 })
  } catch (error: any) {
    console.error("[API /customers] Unexpected error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

