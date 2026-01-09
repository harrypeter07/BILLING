-- ============================================
-- SETUP SUPABASE STORAGE RLS FOR invoice-pdfs BUCKET
-- ============================================
-- This script configures RLS policies for the invoice-pdfs storage bucket
-- Run this in Supabase SQL Editor
-- ============================================

-- First, ensure the bucket exists and is public
-- You can do this via Supabase Dashboard > Storage > Create Bucket
-- Bucket name: invoice-pdfs
-- Public: Yes

-- ============================================
-- STORAGE BUCKET POLICIES
-- ============================================

-- Policy 1: Allow authenticated users (admins) to upload files
CREATE POLICY "Admins can upload invoice PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Allow authenticated users (admins) to read their own files
CREATE POLICY "Admins can read their invoice PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoice-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Allow public read access (for WhatsApp sharing)
-- This allows anyone with the URL to access the PDF
CREATE POLICY "Public can read invoice PDFs"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'invoice-pdfs'
);

-- Policy 4: Allow authenticated users (admins) to update their own files
CREATE POLICY "Admins can update their invoice PDFs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'invoice-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'invoice-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 5: Allow authenticated users (admins) to delete their own files
CREATE POLICY "Admins can delete their invoice PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoice-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- ALTERNATIVE: More Permissive Policy for Server-Side Uploads
-- ============================================
-- If the above policies don't work (because server-side uses service role),
-- use this more permissive policy that allows uploads to any user folder:

-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Admins can upload invoice PDFs" ON storage.objects;

-- Create permissive INSERT policy (for server-side API routes using service role)
CREATE POLICY "Allow invoice PDF uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-pdfs'
);

-- ============================================
-- VERIFICATION
-- ============================================
-- Check policies were created
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%invoice%'
ORDER BY policyname;

-- ============================================
-- NOTES
-- ============================================
-- 1. The bucket must exist before running this script
-- 2. Create bucket via Dashboard: Storage > New Bucket > Name: invoice-pdfs > Public: Yes
-- 3. If using service role key in API routes, the policies should allow authenticated users
-- 4. The folder structure is: {userId}/{invoiceId}/invoice-{invoiceNumber}.pdf
-- 5. Public read policy allows WhatsApp links to work without authentication
-- ============================================
