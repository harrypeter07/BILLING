-- Add business_email column to user_profiles table
-- Run this in Supabase SQL Editor if business_email column doesn't exist

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS business_email TEXT;

-- Add comment
COMMENT ON COLUMN public.user_profiles.business_email IS 'Business email address for invoices and communications';

