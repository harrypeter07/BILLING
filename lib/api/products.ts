import { createClient } from "@/lib/supabase/client"

export async function fetchProducts() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data
}

export async function createProduct(productData: any) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("products")
    .insert({
      ...productData,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateProduct(id: string, updates: any) {
  const supabase = createClient()

  const { data, error } = await supabase.from("products").update(updates).eq("id", id).select().single()

  if (error) throw error
  return data
}

export async function deleteProduct(id: string) {
  const supabase = createClient()

  const { error } = await supabase.from("products").delete().eq("id", id)

  if (error) throw error
}
