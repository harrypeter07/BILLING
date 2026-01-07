-- ============================================
-- BUSINESS SETTINGS EMPLOYEE ACCESS MIGRATION
-- ============================================
-- This migration allows employees to read their admin's business_settings
-- so they can inherit B2B mode and database mode settings
-- ============================================

-- First, drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can manage own settings" ON public.business_settings;

-- Re-create the policy to allow users to manage their own settings
CREATE POLICY "Users can manage own settings" ON public.business_settings
  FOR ALL USING (auth.uid() = user_id);

-- Add policy for employees to read their admin's business_settings
-- This allows employees to read settings for stores they belong to
DROP POLICY IF EXISTS "Employees can read admin settings via store" ON public.business_settings;
CREATE POLICY "Employees can read admin settings via store" ON public.business_settings
  FOR SELECT USING (
    -- User can read their own settings (original behavior)
    auth.uid() = user_id
    OR
    -- Employees can read settings for admins whose stores they belong to
    EXISTS (
      SELECT 1 FROM public.employees emp
      JOIN public.stores s ON s.id = emp.store_id
      WHERE emp.user_id = auth.uid()
      AND s.admin_user_id = business_settings.user_id
    )
  );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

