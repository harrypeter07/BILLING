# Fix: Admin Cannot Create Customers

## 🔴 Problem

Admin cannot create customers on the invoice creation page. Error: `Error creating customer: {}`

## ✅ Root Cause

The RLS rebuild script (`rebuild-invoice-rls-20260108.sql`) only had **SELECT policies** for customers and products, but **no INSERT policies**. When admins or employees tried to create customers/products, RLS was blocking the INSERT operations.

## ✅ Solution

Added INSERT and UPDATE/DELETE policies for both customers and products:

### 1. Customers INSERT Policy
```sql
CREATE POLICY "Store members insert customers"
ON public.customers
FOR INSERT
WITH CHECK (
  -- Admin inserting own customer
  auth.uid() = user_id
  OR
  -- Employee inserting customer for their store's admin
  EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.stores s ON s.id = e.store_id
    WHERE 
      s.admin_user_id = user_id  -- ✅ Check user_id matches admin
      AND (
        store_id = e.store_id     -- ✅ Matching store_id
        OR
        store_id IS NULL          -- ✅ NULL store_id allowed
      )
  )
);
```

### 2. Products INSERT Policy
Same pattern as customers - allows admins and employees to create products.

### 3. UPDATE/DELETE Policies
Added comprehensive policies for both customers and products that allow:
- Admins to manage their own data
- Employees to manage data from their store's admin

## ✅ How It Works

1. **Admin creates customer** → `auth.uid() = user_id` ✅ (policy allows)
2. **Employee creates customer** → Checks `user_id = admin_user_id` AND `store_id` matches ✅ (policy allows)
3. **RLS validates** → INSERT succeeds

## 📋 Testing Checklist

- [ ] Admin can create customer on invoice page
- [ ] Admin can create customer on customers page
- [ ] Employee can create customer on invoice page
- [ ] Employee can create customer on customers page
- [ ] Admin can create product
- [ ] Employee can create product
- [ ] Cross-store isolation: Employee cannot create customer for other store

## 🔧 Files Changed

- `scripts/rebuild-invoice-rls-20260108.sql` - Added INSERT and UPDATE/DELETE policies for customers and products

## 📝 Next Steps

1. **Run the updated SQL script** in Supabase SQL Editor
2. **Test** customer creation on invoice page
3. **Verify** both admin and employee can create customers/products

## ⚠️ Important Note

In `WITH CHECK` clauses, columns are referenced directly (e.g., `user_id`, `store_id`), not with table prefix (e.g., `customers.user_id`). This is a PostgreSQL RLS requirement.
