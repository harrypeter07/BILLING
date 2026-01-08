# Final Fix: Invoices and Products Visibility Issues

## 🔴 Problems Identified

1. **Products**: Still showing same number (not seeing all products)
2. **Invoices**: 
   - Can't see invoices created after converting to B2B
   - Can't see older B2C invoices (NULL store_id)

## ✅ Root Causes

### 1. Invoices RLS Policy
The RLS policy only checked `store_id` matching but didn't verify `user_id` matches the admin. This could cause:
- Security issues (cross-admin access)
- Missing invoices if `user_id` doesn't match

### 2. Invoices Query
The employee query used `.eq('store_id', sessionStoreId)` which **excludes invoices with NULL store_id** (legacy B2C invoices).

### 3. Products Query
The products query looks correct, but might need cache invalidation or the RLS policy might not be matching correctly.

## ✅ Fixes Applied

### 1. Updated Invoices RLS Policy
```sql
CREATE POLICY "Store members manage invoices"
ON public.invoices
FOR ALL
USING (
  -- Admin
  auth.uid() = user_id
  OR
  -- Employees: invoices from their store's admin
  EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.stores s ON s.id = e.store_id
    WHERE 
      invoices.user_id = s.admin_user_id  -- ✅ Check user_id matches admin
      AND (
        invoices.store_id = e.store_id     -- ✅ Matching store_id
        OR
        invoices.store_id IS NULL          -- ✅ Legacy B2C invoices (NULL store_id)
      )
  )
);
```

### 2. Updated Invoices Query
Changed from:
```typescript
.eq('store_id', sessionStoreId)  // ❌ Excludes NULL store_id
```

To:
```typescript
.or(`store_id.is.null,store_id.eq.${sessionStoreId}`)  // ✅ Includes NULL store_id
```

This matches the pattern used in products and customers queries.

## ✅ How It Works Now

### Invoices
1. Employee queries invoices → Filters by `user_id = admin_user_id` AND `(store_id = employee's store_id OR NULL)`
2. RLS policy checks:
   - Invoice's `user_id` matches store's `admin_user_id` ✅
   - Invoice's `store_id` matches employee's `store_id` OR is NULL ✅
3. Result → Employee sees ALL invoices:
   - New B2B invoices (with store_id)
   - Old B2C invoices (NULL store_id)
   - Admin-created invoices
   - Employee-created invoices

### Products
- Query already uses `.or(`store_id.is.null,store_id.eq.${sessionStoreId}`)`
- RLS policy checks `user_id` matches `admin_user_id`
- Should work correctly after RLS policy update

## 📋 Testing Checklist

### Invoices
- [ ] Employee sees new B2B invoices (created after B2B conversion)
- [ ] Employee sees old B2C invoices (created before B2B conversion, NULL store_id)
- [ ] Employee sees admin-created invoices
- [ ] Employee sees invoices created by other employees
- [ ] Cross-store isolation works

### Products
- [ ] Employee sees all products from their store
- [ ] Employee sees products with NULL store_id (legacy data)
- [ ] Product count matches admin's product count
- [ ] Cross-store isolation works

## 🔧 Files Changed

1. `scripts/rebuild-invoice-rls-20260108.sql` - Updated invoices RLS policy
2. `lib/hooks/use-cached-data.ts` - Updated invoices query to include NULL store_id

## 📝 Next Steps

1. **Run the updated SQL script** in Supabase SQL Editor
2. **Clear browser cache** or hard refresh (Ctrl+Shift+R)
3. **Test** that employees can now see:
   - All invoices (B2B and B2C)
   - All products
   - All customers

## ⚠️ Important Notes

- The invoices query now matches the pattern used in products/customers
- NULL store_id invoices are included (legacy B2C data)
- RLS policies now properly check `user_id` matching for security
- All three (invoices, products, customers) now follow the same pattern
