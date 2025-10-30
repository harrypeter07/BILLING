import { createClient } from "@/lib/supabase/client"

export async function fetchCustomers() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data
}

export async function createCustomer(customerData: any) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("customers")
    .insert({
      ...customerData,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCustomer(id: string, updates: any) {
  const supabase = createClient()

  const { data, error } = await supabase.from("customers").update(updates).eq("id", id).select().single()

  if (error) throw error
  return data
}

export async function deleteCustomer(id: string) {
  const supabase = createClient()

  const { error } = await supabase.from("customers").delete().eq("id", id)

  if (error) throw error
}
