-- ============================================
-- RLS POLICY CHECKER
-- ============================================
-- Run this in Supabase SQL Editor to check current RLS policies
-- ============================================

-- Check invoices INSERT policy
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check,
  roles
FROM pg_policies
WHERE tablename = 'invoices'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- Check invoice_items INSERT policy  
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check,
  roles
FROM pg_policies
WHERE tablename = 'invoice_items'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- Check all policies for invoices table
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN qual
    ELSE 'N/A'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN with_check
    ELSE 'N/A'
  END as with_check_clause
FROM pg_policies
WHERE tablename = 'invoices'
ORDER BY cmd, policyname;

-- Check all policies for invoice_items table
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN qual
    ELSE 'N/A'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN with_check
    ELSE 'N/A'
  END as with_check_clause
FROM pg_policies
WHERE tablename = 'invoice_items'
ORDER BY cmd, policyname;

