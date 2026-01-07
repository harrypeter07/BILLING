-- ============================================
-- B2B/B2C SWITCHING SYSTEM MIGRATION
-- ============================================
-- This migration adds controlled B2B/B2C switching with admin → employee propagation
-- 
-- Changes:
-- 1. Add 'allow_b2b_mode' to business_settings (admin master switch)
-- 2. Add 'employee_b2b_mode' to user_profiles (employee personal preference)
-- ============================================

-- Step 1: Add 'allow_b2b_mode' to business_settings (admin master switch)
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS allow_b2b_mode BOOLEAN DEFAULT false;

-- Step 2: Add 'employee_b2b_mode' to user_profiles (employee personal preference)
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS employee_b2b_mode BOOLEAN DEFAULT false;

-- Step 3: Add comment for documentation
COMMENT ON COLUMN public.business_settings.allow_b2b_mode IS 'Master switch: When OFF, admin cannot enable B2B and employees cannot see B2B toggle. When ON, admin can toggle B2B/B2C and employees can see toggle.';
COMMENT ON COLUMN public.user_profiles.employee_b2b_mode IS 'Employee personal B2B preference (only used if admin has allow_b2b_mode = true). Does not affect global B2B setting.';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

