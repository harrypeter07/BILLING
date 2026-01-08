# Fix: Employee Cannot See Admin's Invoices, Products, Customers

## 🔴 Problem

Employees were only seeing their own invoices, not all invoices from their store. This violated the shared-store model where employees and admins should see the same data within a store.

## ✅ Root Cause

The `useInvoices()` hook in `lib/hooks/use-cached-data.ts` was incorrectly filtering invoices by `employee_id`:

```typescript
// WRONG - Only shows employee's own invoices
.or(`created_by_employee_id.eq.${employeeId},employee_id.eq.${employeeId}`)
```

This meant employees could only see invoices they created, not all invoices from their store.

## ✅ Solution

Updated `useInvoices()` to follow the same pattern as `useProducts()` and `useCustomers()`:

1. **Get admin_user_id from store** (for employees)
2. **Query by `user_id = admin_user_id` AND `store_id = employee's store_id`**
3. **RLS policies automatically allow access** because the employee's `store_id` matches

### Fixed Code

```typescript
if (authType === "employee") {
    // Get store to find admin_user_id
    const { data: store } = await supabase
        .from('stores')
        .select('admin_user_id')
        .eq('id', sessionStoreId)
        .maybeSingle()
    
    userId = store.admin_user_id
    
    // Query ALL invoices for this store (shared-store model)
    let query = supabase
        .from('invoices')
        .select('*, customers(name)')
        .eq('user_id', userId)  // Admin's user_id
        .eq('store_id', sessionStoreId)  // Employee's store_id
    
    const { data, error } = await query.order('created_at', { ascending: false })
    return data || []
}
```

## ✅ How It Works

1. **Employee logs in** → Session contains `storeId`
2. **Query fetches store** → Gets `admin_user_id` from `stores` table
3. **Query invoices** → Filters by `user_id = admin_user_id` AND `store_id = employee's store_id`
4. **RLS policy allows** → Because `EXISTS (SELECT 1 FROM employees e WHERE e.store_id = invoices.store_id)` is true
5. **Result** → Employee sees ALL invoices from their store (both admin-created and employee-created)

## ✅ Verification

After this fix, employees should be able to:
- ✅ See all invoices from their store (admin + all employees)
- ✅ See all products from their store (already working)
- ✅ See all customers from their store (already working)
- ✅ Create invoices that are visible to admin
- ✅ Admin sees invoices created by employees

## 📋 Testing Checklist

- [ ] Employee logs in
- [ ] Employee sees all store invoices (not just their own)
- [ ] Employee sees all store products
- [ ] Employee sees all store customers
- [ ] Employee creates invoice → Admin can see it
- [ ] Admin creates invoice → Employee can see it
- [ ] Cross-store isolation: Employee from Store A cannot see Store B data

## 🔧 Files Changed

- `lib/hooks/use-cached-data.ts` - Fixed `useInvoices()` hook

## 📝 Notes

- Products and customers hooks were already correct
- RLS policies were already correct
- Only the invoices query needed fixing
- This maintains the shared-store, isolated-multi-tenant model
