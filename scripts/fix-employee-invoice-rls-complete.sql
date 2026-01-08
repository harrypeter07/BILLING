-- ============================================
-- COMPLETE EMPLOYEE INVOICE RLS FIX
-- ============================================
-- This migration fixes RLS policies to allow employees
-- to create invoices and invoice items
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: Fix invoices INSERT policy
-- ============================================

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can insert own invoices" ON public.invoices;

-- Create a new policy that allows:
-- 1. Admins to insert their own invoices (auth.uid() = user_id)
-- 2. Employees to insert invoices where user_id matches a store's admin_user_id
CREATE POLICY "Users can insert own invoices" ON public.invoices
  FOR INSERT WITH CHECK (
    -- Admin can insert their own invoices (original behavior)
    auth.uid() = user_id
    OR
    -- Allow inserting invoices where user_id matches any store's admin_user_id
    -- This allows employees (who don't have Supabase auth) to insert invoices
    -- The application layer ensures employees only use their admin's user_id
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.admin_user_id = user_id
    )
  );

-- ============================================
-- PART 2: Fix invoice_items policies
-- ============================================

-- Drop all existing invoice_items policies
DROP POLICY IF EXISTS "Users can manage own invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can view own invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can insert own invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can update own invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can delete own invoice items" ON public.invoice_items;

-- Policy for SELECT (viewing items)
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

-- Policy for INSERT (creating items)
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

-- Policy for UPDATE (updating items)
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

-- Policy for DELETE (deleting items)
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
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the policies are created correctly:

-- Check invoices policies
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'invoices'
-- ORDER BY policyname;

-- Check invoice_items policies
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'invoice_items'
-- ORDER BY policyname;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- After running this migration, employees should be able to:
-- 1. Insert invoices with their admin's user_id
-- 2. Insert invoice_items for those invoices
-- 3. View, update, and delete invoice_items for those invoices
-- Without requiring Supabase authentication
-- ============================================

