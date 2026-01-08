-- ============================================
-- ⚠️ COPY THIS ENTIRE FILE AND RUN IN SUPABASE SQL EDITOR ⚠️
-- ============================================
-- This will fix the RLS policies so employees can create invoices
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 1: Fix invoices INSERT policy
-- ============================================

-- Drop ALL existing invoices INSERT policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'invoices' AND cmd = 'INSERT') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.invoices';
    END LOOP;
END $$;

-- Create new INSERT policy that allows employees
CREATE POLICY "Users can insert own invoices" ON public.invoices
  FOR INSERT 
  WITH CHECK (
    -- Option 1: Admin with auth (auth.uid() is not null and matches user_id)
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR
    -- Option 2: Employee/anonymous user - user_id must match a store's admin_user_id
    -- This allows employees (anon key, auth.uid() is null) to insert invoices
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.admin_user_id = user_id
    )
  );

-- ============================================
-- STEP 2: Fix invoice_items policies
-- ============================================

-- Drop ALL existing invoice_items policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'invoice_items') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.invoice_items';
    END LOOP;
END $$;

-- Policy for SELECT (viewing items)
CREATE POLICY "Users can view own invoice items" ON public.invoice_items
  FOR SELECT 
  USING (
    -- Admin can view items for their own invoices
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    ))
    OR
    -- Employees/anonymous can view items for invoices where user_id matches store's admin_user_id
    EXISTS (
      SELECT 1 FROM public.invoices inv
      JOIN public.stores s ON s.admin_user_id = inv.user_id
      WHERE inv.id = invoice_items.invoice_id
    )
  );

-- Policy for INSERT (creating items)
CREATE POLICY "Users can insert own invoice items" ON public.invoice_items
  FOR INSERT 
  WITH CHECK (
    -- Admin can insert items for their own invoices
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    ))
    OR
    -- Employees/anonymous can insert items for invoices where user_id matches store's admin_user_id
    EXISTS (
      SELECT 1 FROM public.invoices inv
      JOIN public.stores s ON s.admin_user_id = inv.user_id
      WHERE inv.id = invoice_items.invoice_id
    )
  );

-- Policy for UPDATE (updating items)
CREATE POLICY "Users can update own invoice items" ON public.invoice_items
  FOR UPDATE 
  USING (
    -- Admin can update items for their own invoices
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    ))
    OR
    -- Employees/anonymous can update items for invoices where user_id matches store's admin_user_id
    EXISTS (
      SELECT 1 FROM public.invoices inv
      JOIN public.stores s ON s.admin_user_id = inv.user_id
      WHERE inv.id = invoice_items.invoice_id
    )
  );

-- Policy for DELETE (deleting items)
CREATE POLICY "Users can delete own invoice items" ON public.invoice_items
  FOR DELETE 
  USING (
    -- Admin can delete items for their own invoices
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    ))
    OR
    -- Employees/anonymous can delete items for invoices where user_id matches store's admin_user_id
    EXISTS (
      SELECT 1 FROM public.invoices inv
      JOIN public.stores s ON s.admin_user_id = inv.user_id
      WHERE inv.id = invoice_items.invoice_id
    )
  );

-- ============================================
-- VERIFICATION - Check if policies were created
-- ============================================
SELECT 
  tablename,
  policyname,
  cmd,
  CASE WHEN with_check IS NOT NULL THEN '✓ Has WITH CHECK' ELSE '✗ No WITH CHECK' END as with_check_status,
  CASE WHEN qual IS NOT NULL THEN '✓ Has USING' ELSE '✗ No USING' END as using_status
FROM pg_policies
WHERE tablename IN ('invoices', 'invoice_items')
ORDER BY tablename, cmd, policyname;

-- ============================================
-- DONE! Now test by creating an invoice as an employee
-- ============================================

