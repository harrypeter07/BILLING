"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { isIndexedDbMode, getActiveDbModeAsync } from "@/lib/utils/db-mode"
import { getCurrentStoreId } from "@/lib/utils/get-current-store-id"

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
                        const session = JSON.parse(empSession)
                        const sessionStoreId = session.storeId
                        if (sessionStoreId) {
                            const { data: store } = await supabase
                                .from('stores')
                                .select('admin_user_id')
                                .eq('id', sessionStoreId)
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

                // Build query with store_id filter
                let query = supabase
                    .from("customers")
                    .select("*")
                    .eq("user_id", userId)

                // Filter by store_id if available (store-scoped isolation)
                if (storeId) {
                    query = query.or(`store_id.is.null,store_id.eq.${storeId}`)
                }

                const { data, error } = await query.order("created_at", { ascending: false })

                if (error) throw error
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
                        const session = JSON.parse(empSession)
                        const sessionStoreId = session.storeId
                        if (sessionStoreId) {
                            const { data: store } = await supabase
                                .from('stores')
                                .select('admin_user_id')
                                .eq('id', sessionStoreId)
                                .single()
                            if (store?.admin_user_id) {
                                userId = store.admin_user_id
                            }
                        }
                    }
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
                    // For employees, show only their own invoices
                    const empSession = localStorage.getItem("employeeSession")
                    if (empSession) {
                        const session = JSON.parse(empSession)
                        const employeeId = session.employeeId
                        if (employeeId) {
                            // Get invoices created by this employee
                            const { data, error } = await supabase
                                .from('invoices')
                                .select('*, customers(name), employees!invoices_created_by_employee_id_fkey(name, employee_id)')
                                .or(`created_by_employee_id.eq.${employeeId},employee_id.eq.${employeeId}`)
                                .order('created_at', { ascending: false })
                            if (error) throw error
                            return data || []
                        }
                    }
                    return []
                } else {
                    // For admin, show all invoices from their stores (including employee invoices)
                    const { data: { user } } = await supabase.auth.getUser()
                    if (!user) return []
                    userId = user.id

                    // Build query - include invoices from admin and all employees under their stores
                    let query = supabase
                        .from('invoices')
                        .select('*, customers(name), employees!invoices_created_by_employee_id_fkey(name, employee_id)')
                    
                    // Filter by store_id if available
                    if (storeId) {
                        // Get invoices for this store (admin's invoices + employee invoices from this store)
                        const { data: storeData } = await supabase
                            .from('stores')
                            .select('id, admin_user_id')
                            .eq('id', storeId)
                            .single()
                        
                        if (storeData) {
                            // Get all employee IDs for this store
                            const { data: employees } = await supabase
                                .from('employees')
                                .select('employee_id')
                                .eq('store_id', storeId)
                            const employeeIds = employees?.map(e => e.employee_id) || []
                            
                            // Query invoices from admin OR employees of this store
                            const conditions = [`user_id.eq.${userId}`]
                            if (employeeIds.length > 0) {
                                conditions.push(`created_by_employee_id.in.(${employeeIds.join(',')})`)
                                conditions.push(`employee_id.in.(${employeeIds.join(',')})`)
                            }
                            query = query.or(conditions.join(','))
                        } else {
                            // Fallback: just admin's invoices
                            query = query.eq('user_id', userId)
                        }
                    } else {
                        // No store selected - show all admin invoices
                        query = query.eq('user_id', userId)
                    }

                    const { data, error } = await query.order('created_at', { ascending: false })
                    if (error) throw error
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
                    .select("*, customers(*), invoice_items(*), employees!invoices_created_by_employee_id_fkey(name, employee_id)")
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
