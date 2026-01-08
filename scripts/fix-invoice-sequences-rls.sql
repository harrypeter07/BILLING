-- ============================================
-- FIX INVOICE_SEQUENCES RLS FOR EMPLOYEES
-- ============================================
-- This allows employees to read/write invoice_sequences
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Store admins can manage invoice sequences" ON public.invoice_sequences;

-- Create new policy that allows employees via store relationship
CREATE POLICY "Store admins and employees can manage invoice sequences" ON public.invoice_sequences
  FOR ALL USING (
    -- Admins can manage sequences for their stores
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.stores 
      WHERE stores.id = invoice_sequences.store_id 
      AND stores.admin_user_id = auth.uid()
    ))
    OR
    -- Employees can manage sequences for stores (via store_id, even without auth.uid())
    -- This allows anonymous users (employees) to access sequences for their store
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = invoice_sequences.store_id
      AND s.admin_user_id IS NOT NULL
    )
  )
  WITH CHECK (
    -- Same conditions for INSERT/UPDATE
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.stores 
      WHERE stores.id = invoice_sequences.store_id 
      AND stores.admin_user_id = auth.uid()
    ))
    OR
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = invoice_sequences.store_id
      AND s.admin_user_id IS NOT NULL
    )
  );

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 
  tablename,
  policyname,
  cmd,
  CASE WHEN with_check IS NOT NULL THEN '✓' ELSE '✗' END as has_with_check,
  CASE WHEN qual IS NOT NULL THEN '✓' ELSE '✗' END as has_using
FROM pg_policies
WHERE tablename = 'invoice_sequences'
ORDER BY cmd, policyname;

-- ============================================
-- DONE!
-- ============================================

