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
    const { name, email, phone, gstin, user_id, store_id, city, state, pincode, billing_address } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 })
    }

    // Validate phone number - exactly 10 digits
    if (phone && phone.trim()) {
      const cleanPhone = phone.replace(/\D/g, '')
      if (cleanPhone.length !== 10) {
        return NextResponse.json({ error: "Phone number must be exactly 10 digits" }, { status: 400 })
      }
    }

    // Validate email format if provided
    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 })
      }
    }

    // Use provided user_id (for employees) or current user's id (for admins)
    const targetUserId = user_id || user.id

    // Get store_id from request or derive from employee session
    let targetStoreId = store_id || null
    
    // If employee, get store_id from their session
    if (!targetStoreId) {
      // Try to get from request headers (set by frontend)
      const storeIdHeader = request.headers.get("x-store-id")
      if (storeIdHeader) {
        targetStoreId = storeIdHeader
      }
    }

    // Check for duplicate email if provided (store-scoped)
    if (email && email.trim()) {
      let duplicateQuery = supabase
        .from("customers")
        .select("id, name, email")
        .eq("user_id", targetUserId)
        .ilike("email", email.trim())
      
      // Filter by store_id if available (store-scoped duplicate check)
      if (targetStoreId) {
        duplicateQuery = duplicateQuery.or(`store_id.is.null,store_id.eq.${targetStoreId}`)
      }
      
      const { data: existingCustomer } = await duplicateQuery.limit(1).single()

      if (existingCustomer) {
        return NextResponse.json(
          { error: `A customer with email "${email.trim()}" already exists: ${existingCustomer.name}` },
          { status: 409 }
        )
      }
    }

    // Build insert object - only include fields that exist in schema
    const customerInsert: any = {
      user_id: targetUserId,
      store_id: targetStoreId, // Store-scoped isolation
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      gstin: gstin?.trim() || null,
      billing_address: billing_address?.trim() || null,
      shipping_address: null,
      notes: null,
    };

    // Add B2B fields from request body if provided (only if they have values)
    if (city !== undefined && city !== null && city.trim() !== '') {
      customerInsert.city = city.trim()
    }
    if (state !== undefined && state !== null && state.trim() !== '') {
      customerInsert.state = state.trim()
    }
    if (pincode !== undefined && pincode !== null && pincode.trim() !== '') {
      customerInsert.pincode = pincode.trim()
    }

    const { data: customer, error } = await supabase
      .from("customers")
      .insert(customerInsert)
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

