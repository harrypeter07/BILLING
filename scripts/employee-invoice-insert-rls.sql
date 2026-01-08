-- ============================================
-- EMPLOYEE INVOICE INSERT RLS MIGRATION
-- ============================================
-- This migration allows employees to insert invoices
-- for stores they belong to (using admin's user_id)
-- ============================================

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can insert own invoices" ON public.invoices;

-- Create a new policy that allows:
-- 1. Admins to insert their own invoices (auth.uid() = user_id)
-- 2. Employees to insert invoices where user_id matches a store's admin_user_id
--    (This allows employees using anon key to insert invoices with admin's user_id)
CREATE POLICY "Users can insert own invoices" ON public.invoices
  FOR INSERT WITH CHECK (
    -- Admin can insert their own invoices (original behavior)
    auth.uid() = user_id
    OR
    -- Allow inserting invoices where user_id matches any store's admin_user_id
    -- This allows employees (who don't have Supabase auth) to insert invoices
    -- The application layer ensures employees only use their admin's user_id
    -- Note: In WITH CHECK, we reference the column directly, not the table
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.admin_user_id = user_id
    )
  );

-- Also update invoice_items policy to allow employees to insert items
-- The existing policy checks if invoice exists and user_id matches
-- We need to allow items for invoices where user_id matches store's admin_user_id
DROP POLICY IF EXISTS "Users can manage own invoice items" ON public.invoice_items;

-- Create separate policies for different operations
-- Policy for SELECT/UPDATE/DELETE (USING clause)
CREATE POLICY "Users can view own invoice items" ON public.invoice_items
  FOR SELECT USING (
    -- Admin can view items for their own invoices
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
    OR
    -- Employees can view items for invoices where user_id matches store's admin_user_id
    EXISTS (
      SELECT 1 FROM public.invoices inv
      JOIN public.stores s ON s.admin_user_id = inv.user_id
      WHERE inv.id = invoice_items.invoice_id
    )
  );

-- Policy for INSERT (WITH CHECK clause)
CREATE POLICY "Users can insert own invoice items" ON public.invoice_items
  FOR INSERT WITH CHECK (
    -- Admin can insert items for their own invoices
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
    OR
    -- Employees can insert items for invoices where user_id matches store's admin_user_id
    EXISTS (
      SELECT 1 FROM public.invoices inv
      JOIN public.stores s ON s.admin_user_id = inv.user_id
      WHERE inv.id = invoice_items.invoice_id
    )
  );

-- Policy for UPDATE/DELETE (USING clause)
CREATE POLICY "Users can update own invoice items" ON public.invoice_items
  FOR UPDATE USING (
    -- Admin can update items for their own invoices
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
    OR
    -- Employees can update items for invoices where user_id matches store's admin_user_id
    EXISTS (
      SELECT 1 FROM public.invoices inv
      JOIN public.stores s ON s.admin_user_id = inv.user_id
      WHERE inv.id = invoice_items.invoice_id
    )
  );

CREATE POLICY "Users can delete own invoice items" ON public.invoice_items
  FOR DELETE USING (
    -- Admin can delete items for their own invoices
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
    OR
    -- Employees can delete items for invoices where user_id matches store's admin_user_id
    EXISTS (
      SELECT 1 FROM public.invoices inv
      JOIN public.stores s ON s.admin_user_id = inv.user_id
      WHERE inv.id = invoice_items.invoice_id
    )
  );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- After running this migration, employees should be able to:
-- 1. Insert invoices with their admin's user_id
-- 2. Insert invoice_items for those invoices
-- Without requiring Supabase authentication
-- ============================================

