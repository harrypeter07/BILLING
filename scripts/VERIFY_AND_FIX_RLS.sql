-- ============================================
-- COMPREHENSIVE RLS VERIFICATION AND FIX
-- ============================================
-- This script checks current policies and fixes them
-- ============================================

-- Step 1: Check current policies
SELECT 
  'CURRENT POLICIES' as status,
  tablename,
  policyname,
  cmd,
  CASE WHEN with_check IS NOT NULL THEN substring(with_check, 1, 100) ELSE 'NULL' END as with_check_preview,
  CASE WHEN qual IS NOT NULL THEN substring(qual, 1, 100) ELSE 'NULL' END as using_preview
FROM pg_policies
WHERE tablename IN ('invoices', 'invoice_items')
ORDER BY tablename, cmd;

-- Step 2: Drop problematic policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop invoices INSERT policies
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'invoices' AND cmd = 'INSERT'
    ) 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.invoices';
        RAISE NOTICE 'Dropped policy: % on invoices', r.policyname;
    END LOOP;
    
    -- Drop invoice_items policies
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'invoice_items'
    ) 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.invoice_items';
        RAISE NOTICE 'Dropped policy: % on invoice_items', r.policyname;
    END LOOP;
END $$;

-- Step 3: Create correct policies
-- Invoices INSERT
CREATE POLICY "Users can insert own invoices" ON public.invoices
  FOR INSERT 
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.admin_user_id = user_id
    )
  );

-- Invoice Items SELECT
CREATE POLICY "Users can view own invoice items" ON public.invoice_items
  FOR SELECT 
  USING (
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    ))
    OR
    EXISTS (
      SELECT 1 FROM public.invoices inv
      JOIN public.stores s ON s.admin_user_id = inv.user_id
      WHERE inv.id = invoice_items.invoice_id
    )
  );

-- Invoice Items INSERT
CREATE POLICY "Users can insert own invoice items" ON public.invoice_items
  FOR INSERT 
  WITH CHECK (
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    ))
    OR
    EXISTS (
      SELECT 1 FROM public.invoices inv
      JOIN public.stores s ON s.admin_user_id = inv.user_id
      WHERE inv.id = invoice_items.invoice_id
    )
  );

-- Invoice Items UPDATE
CREATE POLICY "Users can update own invoice items" ON public.invoice_items
  FOR UPDATE 
  USING (
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    ))
    OR
    EXISTS (
      SELECT 1 FROM public.invoices inv
      JOIN public.stores s ON s.admin_user_id = inv.user_id
      WHERE inv.id = invoice_items.invoice_id
    )
  );

-- Invoice Items DELETE
CREATE POLICY "Users can delete own invoice items" ON public.invoice_items
  FOR DELETE 
  USING (
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    ))
    OR
    EXISTS (
      SELECT 1 FROM public.invoices inv
      JOIN public.stores s ON s.admin_user_id = inv.user_id
      WHERE inv.id = invoice_items.invoice_id
    )
  );

-- Step 4: Verify new policies
SELECT 
  'NEW POLICIES' as status,
  tablename,
  policyname,
  cmd,
  CASE WHEN with_check IS NOT NULL THEN '✓' ELSE '✗' END as has_with_check,
  CASE WHEN qual IS NOT NULL THEN '✓' ELSE '✗' END as has_using
FROM pg_policies
WHERE tablename IN ('invoices', 'invoice_items')
ORDER BY tablename, cmd, policyname;

-- Step 5: Test query to verify stores table is accessible
SELECT 
  'STORES ACCESS CHECK' as test,
  COUNT(*) as store_count,
  COUNT(DISTINCT admin_user_id) as unique_admin_count
FROM public.stores;

