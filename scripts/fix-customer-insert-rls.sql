-- ============================================
-- FIX CUSTOMER INSERT RLS POLICY
-- ============================================
-- This fixes the customer INSERT policy to work for both admins and employees
-- Employees use anon key (auth.uid() is NULL), so the policy needs to be more permissive
-- ============================================

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Store members insert customers" ON public.customers;

-- Create new INSERT policy that works for both admins and employees
CREATE POLICY "Store members insert customers"
ON public.customers
FOR INSERT
WITH CHECK (
  -- Option 1: Admin with auth (auth.uid() is not null and matches user_id)
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  
  OR
  
  -- Option 2: Employee/anonymous user - user_id must match a store's admin_user_id
  -- This allows employees (anon key, auth.uid() is null) to insert customers
  -- The store_id must match the store's id OR be NULL (for legacy data)
  (auth.uid() IS NULL AND EXISTS (
    SELECT 1 
    FROM public.stores s
    WHERE s.admin_user_id = user_id
      AND (
        -- Customer's store_id matches the store's id
        customers.store_id = s.id
        OR
        -- Customer's store_id is NULL (allowed for employees, legacy data)
        customers.store_id IS NULL
      )
  ))
  
  OR
  
  -- Option 3: Even if auth.uid() is not null, allow if user_id matches a store's admin_user_id
  -- This is a fallback for cases where auth exists but user_id is the admin's id
  -- and the store_id matches or is NULL
  EXISTS (
    SELECT 1 
    FROM public.stores s
    WHERE s.admin_user_id = user_id
      AND (
        customers.store_id = s.id
        OR
        customers.store_id IS NULL
      )
  )
);

-- ============================================
-- VERIFICATION
-- ============================================
-- Check the policy was created correctly
SELECT 
  tablename, 
  policyname, 
  cmd, 
  qual, 
  with_check
FROM pg_policies
WHERE tablename = 'customers' 
  AND policyname = 'Store members insert customers'
ORDER BY policyname;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- After running this migration:
-- 1. Admins can insert customers where auth.uid() = user_id
-- 2. Employees can insert customers where user_id matches their store's admin_user_id
-- 3. Store_id can match the store's id OR be NULL (for legacy data)
-- ============================================
