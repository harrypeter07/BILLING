"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { isIndexedDbMode, getActiveDbModeAsync } from "@/lib/utils/db-mode"
import { getCurrentStoreId } from "@/lib/utils/get-current-store-id"
import { toast } from "sonner"

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
    store: (id: string) => ["store", id] as const,
}

// Hook to fetch customers with caching (store-scoped)
export function useCustomers() {
    return useQuery({
        queryKey: queryKeys.customers,
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'
            const storeId = await getCurrentStoreId()

            if (isIndexedDb) {
                // IndexedDB: Filter by store_id if available, but include legacy data (null store_id)
                if (storeId) {
                    const allCustomers = await db.customers.toArray()
                    // Include customers with matching store_id OR null/undefined store_id (legacy data)
                    return allCustomers.filter(
                        (c) => !c.store_id || c.store_id === storeId
                    )
                }
                // Fallback: Return all (for backward compatibility with legacy data)
                return await db.customers.toArray()
            } else {
                const supabase = createClient()
                const authType = localStorage.getItem("authType")
                let userId: string | null = null

                if (authType === "employee") {
                    const empSession = localStorage.getItem("employeeSession")
                    if (empSession) {
                        try {
                            const session = JSON.parse(empSession)
                            const sessionStoreId = session.storeId || storeId
                            if (sessionStoreId) {
                                // Get store to find admin_user_id
                                const { data: store, error: storeError } = await supabase
                                    .from('stores')
                                    .select('admin_user_id')
                                    .eq('id', sessionStoreId)
                                    .maybeSingle()
                                
                                if (storeError) {
                                    toast.error("Data Sync Error", {
                                        description: "Unable to fetch store information. Please contact your administrator or try refreshing the page."
                                    })
                                    console.error("[useCustomers] Error fetching store:", storeError)
                                }
                                
                                if (!store?.admin_user_id) {
                                    toast.error("Data Sync Error", {
                                        description: "Store information is incomplete. Please contact your administrator."
                                    })
                                    return []
                                }
                                
                                userId = store.admin_user_id
                                // For employees, query by store_id (RLS will allow access)
                                let query = supabase
                                    .from("customers")
                                    .select("*")
                                    .eq("user_id", userId)
                                
                                // Filter by store_id
                                query = query.or(`store_id.is.null,store_id.eq.${sessionStoreId}`)
                                
                                const { data, error } = await query.order("created_at", { ascending: false })
                                
                                if (error) {
                                    toast.error("Data Sync Error", {
                                        description: "Unable to load customers. Please check your connection or contact your administrator."
                                    })
                                    console.error("[useCustomers] Error fetching customers:", error)
                                    throw error
                                }
                                return data || []
                            } else {
                                toast.error("Data Sync Error", {
                                    description: "Store ID not found in employee session. Please log out and log in again."
                                })
                                return []
                            }
                        } catch (e: any) {
                            toast.error("Data Sync Error", {
                                description: "Failed to load customer data. Please try refreshing the page or contact your administrator."
                            })
                            console.error("[useCustomers] Error parsing employee session:", e)
                        }
                    } else {
                        toast.error("Data Sync Error", {
                            description: "Employee session not found. Please log out and log in again."
                        })
                    }
                    // If no valid employee session, return empty
                    return []
                } else {
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) userId = user.id
                }

                if (!userId) return []

                // Build query with store_id filter (for admin)
                let query = supabase
                    .from("customers")
                    .select("*")
                    .eq("user_id", userId)

                // Filter by store_id if available (store-scoped isolation)
                if (storeId) {
                    query = query.or(`store_id.is.null,store_id.eq.${storeId}`)
                }

                const { data, error } = await query.order("created_at", { ascending: false })

                if (error) {
                    console.error("[useCustomers] Error fetching customers:", error)
                    throw error
                }
                return data || []
            }
        },
    })
}

// Hook to fetch products with caching (store-scoped)
export function useProducts() {
    return useQuery({
        queryKey: queryKeys.products,
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'
            const storeId = await getCurrentStoreId()

            if (isIndexedDb) {
                // IndexedDB: Filter by store_id if available, but include legacy data (null store_id)
                if (storeId) {
                    const allProducts = await db.products.toArray()
                    // Include products with matching store_id OR null/undefined store_id (legacy data)
                    return allProducts.filter(
                        (p) => !p.store_id || p.store_id === storeId
                    )
                }
                // Fallback: Return all (for backward compatibility with legacy data)
                return await db.products.toArray()
            } else {
                const supabase = createClient()
                const authType = localStorage.getItem("authType")
                let userId: string | null = null

                if (authType === "employee") {
                    // For employees, get admin_user_id from store to share products
                    const empSession = localStorage.getItem("employeeSession")
                    if (empSession) {
                        try {
                            const session = JSON.parse(empSession)
                            const sessionStoreId = session.storeId || storeId
                            if (sessionStoreId) {
                                // Get store to find admin_user_id
                                const { data: store, error: storeError } = await supabase
                                    .from('stores')
                                    .select('admin_user_id')
                                    .eq('id', sessionStoreId)
                                    .maybeSingle()
                                
                                if (storeError) {
                                    toast.error("Data Sync Error", {
                                        description: "Unable to fetch store information. Please contact your administrator or try refreshing the page."
                                    })
                                    console.error("[useProducts] Error fetching store:", storeError)
                                }
                                
                                if (!store?.admin_user_id) {
                                    toast.error("Data Sync Error", {
                                        description: "Store information is incomplete. Please contact your administrator."
                                    })
                                    return []
                                }
                                
                                userId = store.admin_user_id
                                // For employees, query by store_id (RLS will allow access)
                                let query = supabase
                                    .from("products")
                                    .select("*")
                                    .eq("user_id", userId)
                                    .eq("is_active", true) // Only active products
                                
                                // Filter by store_id
                                query = query.or(`store_id.is.null,store_id.eq.${sessionStoreId}`)
                                
                                const { data, error } = await query.order("created_at", { ascending: false })
                                
                                if (error) {
                                    toast.error("Data Sync Error", {
                                        description: "Unable to load products. Please check your connection or contact your administrator."
                                    })
                                    console.error("[useProducts] Error fetching products:", error)
                                    throw error
                                }
                                return data || []
                            } else {
                                toast.error("Data Sync Error", {
                                    description: "Store ID not found in employee session. Please log out and log in again."
                                })
                                return []
                            }
                        } catch (e: any) {
                            toast.error("Data Sync Error", {
                                description: "Failed to load product data. Please try refreshing the page or contact your administrator."
                            })
                            console.error("[useProducts] Error parsing employee session:", e)
                        }
                    } else {
                        toast.error("Data Sync Error", {
                            description: "Employee session not found. Please log out and log in again."
                        })
                    }
                    // If no valid employee session, return empty
                    return []
                } else {
                    // For admin, use their own user_id
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) userId = user.id
                }

                if (!userId) return []

                // Build query with store_id filter (shared across employees/admins with same store_id)
                let query = supabase
                    .from("products")
                    .select("*")
                    .eq("user_id", userId)

                // Filter by store_id if available (store-scoped isolation)
                if (storeId) {
                    query = query.or(`store_id.is.null,store_id.eq.${storeId}`)
                }

                const { data, error } = await query.order("created_at", { ascending: false })

                if (error) {
                    console.error("[useProducts] Error fetching products:", error)
                    throw error
                }
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
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'

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
                const authType = localStorage.getItem("authType")
                let userId: string | null = null
                const storeId = await getCurrentStoreId()

                if (authType === "employee") {
                    // For employees, show ALL invoices from their store (shared-store model)
                    const empSession = localStorage.getItem("employeeSession")
                    if (empSession) {
                        try {
                            const session = JSON.parse(empSession)
                            const sessionStoreId = session.storeId || storeId
                            
                            if (sessionStoreId) {
                                // Get store to find admin_user_id
                                const { data: store, error: storeError } = await supabase
                                    .from('stores')
                                    .select('admin_user_id')
                                    .eq('id', sessionStoreId)
                                    .maybeSingle()
                                
                                if (storeError) {
                                    toast.error("Data Sync Error", {
                                        description: "Unable to fetch store information. Please contact your administrator or try refreshing the page."
                                    })
                                    console.error("[useInvoices] Error fetching store:", storeError)
                                    throw storeError
                                }
                                
                                if (!store?.admin_user_id) {
                                    toast.error("Data Sync Error", {
                                        description: "Store information is incomplete. Please contact your administrator."
                                    })
                                    return []
                                }
                                
                                userId = store.admin_user_id
                                
                                // Query all invoices for this store (RLS will allow access)
                                // Filter by user_id (admin) and store_id to get all store invoices
                                // Include NULL store_id for legacy B2C invoices
                                let query = supabase
                                    .from('invoices')
                                    .select('*, customers(name)')
                                    .eq('user_id', userId)
                                
                                // Filter by store_id (include NULL for legacy data)
                                query = query.or(`store_id.is.null,store_id.eq.${sessionStoreId}`)
                                
                                const { data, error } = await query.order('created_at', { ascending: false })
                                
                                if (error) {
                                    toast.error("Data Sync Error", {
                                        description: "Unable to load invoices. Please check your connection or contact your administrator."
                                    })
                                    console.error("[useInvoices] Error fetching invoices:", error)
                                    throw error
                                }
                                
                                return data || []
                            } else {
                                toast.error("Data Sync Error", {
                                    description: "Store ID not found in employee session. Please log out and log in again."
                                })
                                return []
                            }
                        } catch (e: any) {
                            toast.error("Data Sync Error", {
                                description: "Failed to load invoice data. Please try refreshing the page or contact your administrator."
                            })
                            console.error("[useInvoices] Error parsing employee session:", e)
                            return []
                        }
                    } else {
                        toast.error("Data Sync Error", {
                            description: "Employee session not found. Please log out and log in again."
                        })
                    }
                    return []
                } else {
                    // For admin, show all invoices where user_id = admin_user_id
                    // This includes both admin-created and employee-created invoices
                    // (since employees use admin's user_id when creating invoices)
                    const { data: { user } } = await supabase.auth.getUser()
                    if (!user) {
                        console.warn("[useInvoices] Admin not authenticated")
                        return []
                    }
                    userId = user.id

                    // Simple query: all invoices for this admin's user_id
                    // Filter by store_id if provided
                    let query = supabase
                        .from('invoices')
                        .select('*, customers(name)')
                        .eq('user_id', userId)
                    
                    // Optionally filter by store_id
                    if (storeId) {
                        query = query.eq('store_id', storeId)
                    }

                    const { data, error } = await query.order('created_at', { ascending: false })
                    
                    if (error) {
                        console.error("[useInvoices] Error fetching invoices:", error)
                        toast.error("Data Sync Error", {
                            description: `Unable to fetch invoices: ${error.message}. Please try refreshing the page.`
                        })
                        throw error
                    }
                    
                    return data || []
                }
            }
        },
    })
}

// Hook to fetch employees with caching
export function useEmployees() {
    return useQuery({
        queryKey: queryKeys.employees,
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'

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

// Hook to fetch stores with caching
export function useStores() {
    return useQuery({
        queryKey: queryKeys.stores,
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'

            if (isIndexedDb) {
                return await db.stores.toArray()
            } else {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return []

                const { data, error } = await supabase
                    .from("stores")
                    .select("*")
                    .eq("admin_user_id", user.id)
                    .order("created_at", { ascending: false })

                if (error) throw error
                return data || []
            }
        },
    })
}

// Hook to fetch a single store by ID
export function useStore(id: string) {
    return useQuery({
        queryKey: queryKeys.store(id),
        queryFn: async () => {
            const isIndexedDb = isIndexedDbMode()

            if (isIndexedDb) {
                return await db.stores.get(id)
            } else {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from("stores")
                    .select("*")
                    .eq("id", id)
                    .single()

                if (error) throw error
                return data
            }
        },
        enabled: !!id,
    })
}

// Hook to fetch a single employee by ID
export function useEmployee(id: string) {
    return useQuery({
        queryKey: queryKeys.employee(id),
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'

            if (isIndexedDb) {
                const employee = await db.employees.get(id)
                if (!employee) return null

                // Get store info if store_id exists
                if (employee.store_id) {
                    const store = await db.stores.get(employee.store_id)
                    return { ...employee, stores: store }
                }
                return employee
            } else {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from("employees")
                    .select("*, stores(name, store_code)")
                    .eq("id", id)
                    .single()

                if (error) throw error
                return data
            }
        },
        enabled: !!id,
    })
}

// Hook to fetch a single customer by ID
export function useCustomer(id: string) {
    return useQuery({
        queryKey: queryKeys.customer(id),
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'

            if (isIndexedDb) {
                return await db.customers.get(id)
            } else {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from("customers")
                    .select("*")
                    .eq("id", id)
                    .single()

                if (error) throw error
                return data
            }
        },
        enabled: !!id,
    })
}

// Hook to fetch a single product by ID
export function useProduct(id: string) {
    return useQuery({
        queryKey: queryKeys.product(id),
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'

            if (isIndexedDb) {
                return await db.products.get(id)
            } else {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from("products")
                    .select("*")
                    .eq("id", id)
                    .single()

                if (error) throw error
                return data
            }
        },
        enabled: !!id,
    })
}

// Hook to fetch a single invoice by ID with items
export function useInvoice(id: string) {
    return useQuery({
        queryKey: queryKeys.invoice(id),
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'

            if (isIndexedDb) {
                const invoice = await db.invoices.get(id)
                if (!invoice) return null

                // Get customer info
                const customer = await db.customers.get(invoice.customer_id)

                // Get employee info if invoice was created by employee
                let employee = null
                if (invoice.created_by_employee_id || invoice.employee_id) {
                    const employeeId = invoice.created_by_employee_id || invoice.employee_id
                    employee = await db.employees.where("employee_id").equals(employeeId).first()
                }

                // Get invoice items
                const items = await db.invoice_items.where("invoice_id").equals(id).toArray()

                return {
                    ...invoice,
                    customers: customer || null,
                    employees: employee ? { name: employee.name, employee_id: employee.employee_id } : null,
                    invoice_items: items,
                }
            } else {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from("invoices")
                    .select("*, customers(*), invoice_items(*)")
                    .eq("id", id)
                    .single()

                if (error) throw error
                return data
            }
        },
        enabled: !!id,
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
        invalidateStores: () => queryClient.invalidateQueries({ queryKey: queryKeys.stores }),
        invalidateStore: (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.store(id) }),
        invalidateEmployee: (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.employee(id) }),
        invalidateCustomer: (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.customer(id) }),
        invalidateProduct: (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.product(id) }),
        invalidateInvoice: (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.invoice(id) }),
        invalidateAll: () => queryClient.invalidateQueries(),
    }
}
