-- Test queries to simulate employee login flow
-- Run these to verify RLS policies allow login

-- ============================================
-- 1. TEST STORE LOOKUP (as unauthenticated user)
-- ============================================
-- This simulates what happens during employee login
-- Should return stores even without auth.uid()

-- Test 1: Lookup by store_code
SELECT * FROM public.stores 
WHERE store_code = 'DEMO';

-- Test 2: Lookup by name (case-insensitive)
SELECT * FROM public.stores 
WHERE name ILIKE '%demostore%';

-- Test 3: Get all stores (should work for login)
SELECT id, name, store_code, admin_user_id 
FROM public.stores 
WHERE admin_user_id IS NOT NULL;

-- ============================================
-- 2. TEST EMPLOYEE LOOKUP (as unauthenticated user)
-- ============================================
-- This should work with the new RLS policy

-- Test: Find employee DE01 in DEMO store
SELECT 
    e.id,
    e.employee_id,
    e.name,
    e.store_id,
    e.password IS NOT NULL as has_password,
    s.name as store_name,
    s.store_code
FROM public.employees e
INNER JOIN public.stores s ON e.store_id = s.id
WHERE e.employee_id = 'DE01'
  AND s.store_code = 'DEMO'
LIMIT 1;

-- Test: Find employee DE02 in DEMO store
SELECT 
    e.id,
    e.employee_id,
    e.name,
    e.store_id,
    s.name as store_name,
    s.store_code
FROM public.employees e
INNER JOIN public.stores s ON e.store_id = s.id
WHERE e.employee_id = 'DE02'
  AND s.store_code = 'DEMO'
LIMIT 1;

-- ============================================
-- 3. VERIFY RLS IS ALLOWING THESE QUERIES
-- ============================================
-- Check if current user can read
SELECT 
    current_user as db_user,
    session_user as session_user;

-- ============================================
-- 4. TEST FULL LOGIN FLOW QUERY
-- ============================================
-- Complete query that employee login would run
WITH store_lookup AS (
    SELECT id, name, store_code, admin_user_id
    FROM public.stores
    WHERE store_code = 'DEMO'
       OR name ILIKE '%demostore%'
    LIMIT 1
)
SELECT 
    e.id,
    e.employee_id,
    e.name as employee_name,
    e.store_id,
    e.password IS NOT NULL as has_password,
    s.id as store_id,
    s.name as store_name,
    s.store_code,
    s.admin_user_id IS NOT NULL as store_has_admin
FROM store_lookup s
INNER JOIN public.employees e ON e.store_id = s.id
WHERE e.employee_id = 'DE01'
LIMIT 1;

