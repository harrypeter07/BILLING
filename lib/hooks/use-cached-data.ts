"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { isIndexedDbMode } from "@/lib/utils/db-mode"

// Query keys for consistent caching
export const queryKeys = {
    customers: ["customers"] as const,
    products: ["products"] as const,
    invoices: ["invoices"] as const,
    employees: ["employees"] as const,
    stores: ["stores"] as const,
    employee: (id: string) => ["employee", id] as const,
    customer: (id: string) => ["customer", id] as const,
    product: (id: string) => ["product", id] as const,
    invoice: (id: string) => ["invoice", id] as const,
}

// Hook to fetch customers with caching
export function useCustomers() {
    return useQuery({
        queryKey: queryKeys.customers,
        queryFn: async () => {
            const isIndexedDb = isIndexedDbMode()

            if (isIndexedDb) {
                return await db.customers.toArray()
            } else {
                const supabase = createClient()
                const authType = localStorage.getItem("authType")
                let userId: string | null = null

                if (authType === "employee") {
                    const empSession = localStorage.getItem("employeeSession")
                    if (empSession) {
                        const session = JSON.parse(empSession)
                        const storeId = session.storeId
                        if (storeId) {
                            const { data: store } = await supabase
                                .from('stores')
                                .select('admin_user_id')
                                .eq('id', storeId)
                                .single()
                            if (store?.admin_user_id) {
                                userId = store.admin_user_id
                            }
                        }
                    }
                } else {
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) userId = user.id
                }

                if (!userId) return []

                const { data, error } = await supabase
                    .from("customers")
                    .select("*")
                    .eq("user_id", userId)
                    .order("created_at", { ascending: false })

                if (error) throw error
                return data || []
            }
        },
    })
}

// Hook to fetch products with caching
export function useProducts() {
    return useQuery({
        queryKey: queryKeys.products,
        queryFn: async () => {
            const isIndexedDb = isIndexedDbMode()

            if (isIndexedDb) {
                return await db.products.toArray()
            } else {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return []

                const { data, error } = await supabase
                    .from("products")
                    .select("*")
                    .eq("user_id", user.id)
                    .order("created_at", { ascending: false })

                if (error) throw error
                return data || []
            }
        },
    })
}

// Hook to fetch invoices with caching
export function useInvoices() {
    return useQuery({
        queryKey: queryKeys.invoices,
        queryFn: async () => {
            const isIndexedDb = isIndexedDbMode()

            if (isIndexedDb) {
                const list = await db.invoices.toArray()
                const customers = await db.customers.toArray()
                const customersMap = new Map(customers.map(c => [c.id, c]))
                return list.map(inv => ({
                    ...inv,
                    customers: customersMap.get(inv.customer_id) ? { name: customersMap.get(inv.customer_id)!.name } : null
                }))
            } else {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return []

                const { data, error } = await supabase
                    .from('invoices')
                    .select('*, customers(name)')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })

                if (error) throw error
                return data || []
            }
        },
    })
}

// Hook to fetch employees with caching
export function useEmployees() {
    return useQuery({
        queryKey: queryKeys.employees,
        queryFn: async () => {
            const isIndexedDb = isIndexedDbMode()

            if (isIndexedDb) {
                return await db.employees.toArray()
            } else {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return []

                const { data, error } = await supabase
                    .from("employees")
                    .select("*, stores(name, store_code)")
                    .eq("user_id", user.id)
                    .order("created_at", { ascending: false })

                if (error) throw error
                return data || []
            }
        },
    })
}

// Hook to invalidate cache when data changes
export function useInvalidateQueries() {
    const queryClient = useQueryClient()

    return {
        invalidateCustomers: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers }),
        invalidateProducts: () => queryClient.invalidateQueries({ queryKey: queryKeys.products }),
        invalidateInvoices: () => queryClient.invalidateQueries({ queryKey: queryKeys.invoices }),
        invalidateEmployees: () => queryClient.invalidateQueries({ queryKey: queryKeys.employees }),
        invalidateAll: () => queryClient.invalidateQueries(),
    }
}
