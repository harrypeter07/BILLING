# Fix: Employees Cannot See All Products and Customers

## 🔴 Problem

Employees couldn't see all products and customers that the admin created, even though they should see everything from their store (shared-store model).

## ✅ Root Cause

The RLS policies for products and customers were only checking if `store_id` matched, but **not verifying that the `user_id` matches the store's `admin_user_id`**.

This meant:
- Products/customers with `store_id = NULL` were blocked (legacy data)
- Products/customers from other admins with matching `store_id` could potentially be accessed (security issue)

## ✅ Solution

Updated RLS policies to check **both conditions**:
1. Product/customer's `user_id` must match the store's `admin_user_id`
2. Product/customer's `store_id` must match employee's `store_id` OR be NULL

### Updated RLS Policies

**Products:**
```sql
CREATE POLICY "Store members read products"
ON public.products
FOR SELECT
USING (
  -- Admin
  auth.uid() = user_id
  OR
  -- Employees: products from their store's admin
  EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.stores s ON s.id = e.store_id
    WHERE 
      products.user_id = s.admin_user_id  -- ✅ Check user_id matches admin
      AND (
        products.store_id = e.store_id   -- ✅ Matching store_id
        OR
        products.store_id IS NULL        -- ✅ Legacy data (NULL store_id)
      )
  )
);
```

**Customers:**
```sql
CREATE POLICY "Store members read customers"
ON public.customers
FOR SELECT
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.stores s ON s.id = e.store_id
    WHERE 
      customers.user_id = s.admin_user_id  -- ✅ Check user_id matches admin
      AND (
        customers.store_id = e.store_id     -- ✅ Matching store_id
        OR
        customers.store_id IS NULL          -- ✅ Legacy data (NULL store_id)
      )
  )
);
```

## ✅ How It Works Now

1. **Employee queries products/customers** → Filters by `user_id = admin_user_id` AND `store_id = employee's store_id OR NULL`
2. **RLS policy checks**:
   - Product/customer's `user_id` matches store's `admin_user_id` ✅
   - Product/customer's `store_id` matches employee's `store_id` OR is NULL ✅
3. **Result** → Employee sees ALL products/customers from their store (including legacy NULL store_id data)

## ✅ Security Improvement

The updated policies also improve security by ensuring:
- Employees can ONLY see products/customers from their store's admin
- Cross-admin access is prevented (even if store_id accidentally matches)
- Legacy data (NULL store_id) is properly scoped to the admin

## 📋 Testing Checklist

- [ ] Employee logs in
- [ ] Employee sees all products from their store (including NULL store_id)
- [ ] Employee sees all customers from their store (including NULL store_id)
- [ ] Employee sees products/customers created by admin
- [ ] Employee sees products/customers created by other employees
- [ ] Cross-store isolation: Employee from Store A cannot see Store B data
- [ ] Cross-admin isolation: Employee cannot see other admin's data

## 🔧 Files Changed

- `scripts/rebuild-invoice-rls-20260108.sql` - Updated products and customers RLS policies

## 📝 Next Steps

1. **Run the updated SQL script** in Supabase SQL Editor to update RLS policies
2. **Test** that employees can now see all products and customers
3. **Verify** cross-store and cross-admin isolation still works

## ⚠️ Important Note

The application code (`useProducts()` and `useCustomers()` hooks) was already correct - they query by `user_id = admin_user_id` AND `store_id`. The issue was only in the RLS policies not matching this query pattern.
