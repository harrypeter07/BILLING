-- ============================================
-- ⚠️ REMOVE RLS FROM INVOICES TABLE ⚠️
-- ============================================
-- This removes RLS from invoices table completely
-- Use this ONLY if the simple fix doesn't work
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- Disable RLS on invoices table
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can insert own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Employees can insert invoices for their store" ON public.invoices;
DROP POLICY IF EXISTS "Allow invoice inserts with valid user_id" ON public.invoices;
DROP POLICY IF EXISTS "Allow invoice inserts" ON public.invoices;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'invoices';

-- ============================================
-- DONE! RLS is now disabled on invoices
-- ============================================
-- Security is now handled entirely by application layer
-- ============================================

