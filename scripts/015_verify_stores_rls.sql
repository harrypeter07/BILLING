-- CRITICAL: Verify stores table RLS policies for employee login
-- This checks if stores can be read during employee login (without auth)

-- ============================================
-- 1. CHECK ALL STORES TABLE POLICIES
-- ============================================
SELECT 
    policyname,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'stores'
AND schemaname = 'public'
ORDER BY policyname;

-- ============================================
-- 2. VERIFY STORES HAVE admin_user_id
-- ============================================
SELECT 
    id,
    name,
    store_code,
    admin_user_id IS NOT NULL as has_admin,
    admin_user_id
FROM public.stores
ORDER BY created_at DESC;

-- ============================================
-- 3. TEST IF STORES CAN BE READ (simulates employee login)
-- ============================================
-- This should work even without auth.uid()
-- The "Stores can be read for employee login" policy should allow this
SELECT 
    id,
    name,
    store_code,
    admin_user_id
FROM public.stores
WHERE store_code = 'DEMO';

-- ============================================
-- 4. TEST BY NAME
-- ============================================
SELECT 
    id,
    name,
    store_code,
    admin_user_id
FROM public.stores
WHERE name ILIKE '%demostore%';

-- ============================================
-- 5. IF ABOVE FAILS, CREATE THE POLICY
-- ============================================
-- Run this if stores cannot be read:

-- DROP POLICY IF EXISTS "Stores can be read for employee login" ON public.stores;
-- CREATE POLICY "Stores can be read for employee login" ON public.stores
--   FOR SELECT
--   USING (admin_user_id IS NOT NULL);

-- ============================================
-- 6. VERIFY EMPLOYEE LOOKUP WORKS
-- ============================================
SELECT 
    e.id,
    e.employee_id,
    e.name,
    e.store_id,
    s.id as store_exists,
    s.name as store_name,
    s.store_code,
    s.admin_user_id IS NOT NULL as store_has_admin
FROM public.employees e
LEFT JOIN public.stores s ON e.store_id = s.id
WHERE e.employee_id IN ('DE01', 'DE02')
ORDER BY e.employee_id;

