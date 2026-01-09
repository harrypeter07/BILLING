-- ============================================
-- ADD B2B COLUMNS TO CUSTOMERS TABLE
-- ============================================
-- This migration adds city, state, and pincode columns to the customers table
-- These are required for B2B invoice generation
-- ============================================

-- Add B2B-specific columns to customers table
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT;

-- Add store_id column if it doesn't exist (for multi-store support)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

-- Create index on store_id for faster queries
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON public.customers(store_id);

-- ============================================
-- VERIFICATION
-- ============================================
-- Check that columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customers'
  AND column_name IN ('city', 'state', 'pincode', 'store_id')
ORDER BY column_name;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- After running this migration:
-- 1. customers table will have city, state, pincode columns
-- 2. customers table will have store_id column for multi-store support
-- 3. All columns are nullable to support existing data
-- ============================================
