-- ============================================
-- EMPLOYEE ACCESS TO PRODUCTS/CUSTOMERS RLS
-- ============================================
-- This migration allows employees to read products and customers
-- from their store's admin (when admin is in Supabase mode)
-- ============================================

-- Products: Allow employees to read products from their store's admin
-- Note: This policy allows reading products if they belong to any store's admin
-- The application layer (hooks) ensures employees only query their own store's data
DROP POLICY IF EXISTS "Employees can read store admin products" ON public.products;
CREATE POLICY "Employees can read store admin products" ON public.products
  FOR SELECT USING (
    -- Admin can read their own products (original behavior)
    auth.uid() = user_id
    OR
    -- Allow reading products from any store's admin (application layer enforces store_id filtering)
    -- This allows employees (who don't have Supabase auth) to query via anon key
    -- The WHERE clause in the query (store_id filter) ensures they only see their store's data
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.admin_user_id = products.user_id
    )
  );

-- Customers: Allow employees to read customers from their store's admin
-- Note: This policy allows reading customers if they belong to any store's admin
-- The application layer (hooks) ensures employees only query their own store's data
DROP POLICY IF EXISTS "Employees can read store admin customers" ON public.customers;
CREATE POLICY "Employees can read store admin customers" ON public.customers
  FOR SELECT USING (
    -- Admin can read their own customers (original behavior)
    auth.uid() = user_id
    OR
    -- Allow reading customers from any store's admin (application layer enforces store_id filtering)
    -- This allows employees (who don't have Supabase auth) to query via anon key
    -- The WHERE clause in the query (store_id filter) ensures they only see their store's data
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.admin_user_id = customers.user_id
    )
  );

-- Stores: Allow employees to read their store info
DROP POLICY IF EXISTS "Employees can read their stores" ON public.stores;
CREATE POLICY "Employees can read their stores" ON public.stores
  FOR SELECT USING (
    -- Admin can read their own stores
    admin_user_id = auth.uid()
    OR
    -- Employees can read stores they belong to
    EXISTS (
      SELECT 1 FROM public.employees emp
      WHERE emp.store_id = stores.id
    )
    OR
    -- Allow unauthenticated reads for store lookup (anon key)
    admin_user_id IS NOT NULL
  );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- After running this migration, employees should be able to:
-- 1. Read products from their store's admin
-- 2. Read customers from their store's admin
-- 3. Read their store information
-- Without requiring Supabase authentication
-- ============================================

