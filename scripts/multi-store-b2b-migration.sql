-- ============================================
-- MULTI-STORE DATA ISOLATION + B2B UPGRADE MIGRATION
-- ============================================
-- This migration adds store_id to products and customers
-- Adds B2B feature flag to business_settings
-- Updates indexes for better performance
-- 
-- IMPORTANT: This is a safe migration - existing data continues to work
-- store_id will be NULL for existing records (defaults to first store)
-- ============================================

-- Step 1: Add store_id to products table (if not exists)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

-- Create index for store_id on products
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);

-- Create composite index for faster queries (user_id + store_id)
CREATE INDEX IF NOT EXISTS idx_products_user_store ON public.products(user_id, store_id) 
WHERE store_id IS NOT NULL;

-- Step 2: Add store_id to customers table (if not exists)
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

-- Create index for store_id on customers
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON public.customers(store_id);

-- Create composite index for faster queries (user_id + store_id)
CREATE INDEX IF NOT EXISTS idx_customers_user_store ON public.customers(user_id, store_id) 
WHERE store_id IS NOT NULL;

-- Step 3: Add B2B feature flag to business_settings
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS is_b2b_enabled BOOLEAN DEFAULT false;

-- Add place_of_supply if not exists (needed for B2B tax calculation)
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS place_of_supply TEXT;

-- Add business_email if not exists (needed for B2B invoices)
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS business_email TEXT;

-- Step 4: Update RLS policies to enforce store_id filtering
-- Note: These policies will be updated to check store_id in addition to user_id

-- Drop existing policies that need updating
DROP POLICY IF EXISTS "Users can view own products" ON public.products;
DROP POLICY IF EXISTS "Users can manage own products" ON public.products;
DROP POLICY IF EXISTS "Users can view own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can manage own customers" ON public.customers;

-- Create helper function to get current store_id from session/context
-- This function will be used by RLS policies
CREATE OR REPLACE FUNCTION public.current_store_id()
RETURNS UUID AS $$
DECLARE
  store_id_val UUID;
BEGIN
  -- Try to get from session variable (set by application)
  store_id_val := current_setting('app.current_store_id', true)::UUID;
  
  -- If not set, try to get from employee's store
  IF store_id_val IS NULL THEN
    SELECT e.store_id INTO store_id_val
    FROM public.employees e
    WHERE e.user_id = auth.uid()
    LIMIT 1;
  END IF;
  
  RETURN store_id_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Products RLS Policies (store-scoped)
CREATE POLICY "Users can view own store products" ON public.products
  FOR SELECT
  USING (
    auth.uid() = user_id 
    AND (
      store_id IS NULL  -- Legacy data (backward compatible)
      OR store_id = public.current_store_id()  -- Store-scoped data
    )
  );

CREATE POLICY "Users can manage own store products" ON public.products
  FOR ALL
  USING (
    auth.uid() = user_id 
    AND (
      store_id IS NULL  -- Legacy data (backward compatible)
      OR store_id = public.current_store_id()  -- Store-scoped data
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (
      store_id IS NULL  -- Allow NULL for backward compatibility
      OR store_id = public.current_store_id()  -- Enforce store scope
    )
  );

-- Customers RLS Policies (store-scoped)
CREATE POLICY "Users can view own store customers" ON public.customers
  FOR SELECT
  USING (
    auth.uid() = user_id 
    AND (
      store_id IS NULL  -- Legacy data (backward compatible)
      OR store_id = public.current_store_id()  -- Store-scoped data
    )
  );

CREATE POLICY "Users can manage own store customers" ON public.customers
  FOR ALL
  USING (
    auth.uid() = user_id 
    AND (
      store_id IS NULL  -- Legacy data (backward compatible)
      OR store_id = public.current_store_id()  -- Store-scoped data
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (
      store_id IS NULL  -- Allow NULL for backward compatibility
      OR store_id = public.current_store_id()  -- Enforce store scope
    )
  );

-- Step 5: Add comments for documentation
COMMENT ON COLUMN public.products.store_id IS 'Store scope for multi-store isolation. NULL = legacy data (all stores)';
COMMENT ON COLUMN public.customers.store_id IS 'Store scope for multi-store isolation. NULL = legacy data (all stores)';
COMMENT ON COLUMN public.business_settings.is_b2b_enabled IS 'Feature flag to enable B2B billing mode. When enabled, GSTIN and tax compliance are enforced.';
COMMENT ON COLUMN public.business_settings.place_of_supply IS 'Place of supply state code for B2B tax calculation (CGST/SGST vs IGST)';
COMMENT ON COLUMN public.business_settings.business_email IS 'Business email address for B2B invoices';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Update application code to always set store_id when creating products/customers
-- 2. Update all queries to filter by store_id
-- 3. Update frontend to use active store context
-- 4. Test B2B feature toggle
-- ============================================

