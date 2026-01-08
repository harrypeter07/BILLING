-- ============================================
-- FIX BUSINESS SETTINGS RLS INFINITE RECURSION
-- ============================================
-- The previous policy was causing infinite recursion because it checked
-- the employees table, which has RLS enabled and may trigger other checks.
-- 
-- Solution: Allow reading business_settings for any admin who owns stores.
-- Since employees don't have Supabase auth (auth.uid() is null), they use
-- anon key. We allow anon reads for any admin's settings, and the application
-- layer filters based on localStorage storeId.
-- ============================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Employees can read admin settings via store" ON public.business_settings;

-- Create a simpler policy that doesn't check employees table
-- This allows reading business_settings for any admin who has stores
-- The application layer (getB2BModeConfig) ensures employees only read
-- settings for their store's admin (identified via localStorage storeId)
CREATE POLICY "Employees can read admin settings via store" ON public.business_settings
  FOR SELECT USING (
    -- User can read their own settings (original behavior)
    auth.uid() = user_id
    OR
    -- Allow reading settings for any admin who has stores
    -- This avoids checking employees table to prevent recursion
    -- The application layer filters based on storeId from localStorage
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.admin_user_id = business_settings.user_id
    )
  );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- This policy now allows:
-- 1. Admins to read their own settings (via auth.uid())
-- 2. Anyone (including employees with anon key) to read settings for admins who have stores
-- 
-- The application layer in getB2BModeConfig() ensures employees only query
-- settings for their specific admin (via storeId -> admin_user_id lookup)
-- ============================================


