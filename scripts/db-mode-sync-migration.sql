-- ============================================
-- DATABASE MODE SYNC MIGRATION
-- ============================================
-- This migration adds database_mode to business_settings
-- to allow employees to inherit admin's database mode
-- ============================================

-- Add database_mode column to business_settings
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS database_mode TEXT DEFAULT 'indexeddb' CHECK (database_mode IN ('indexeddb', 'supabase'));

-- Update comment
COMMENT ON COLUMN public.business_settings.database_mode IS 'Database mode preference (indexeddb or supabase). Employees inherit this from admin.';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

