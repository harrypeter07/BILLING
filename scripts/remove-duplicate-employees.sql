-- ============================================
-- REMOVE DUPLICATE EMPLOYEES SCRIPT
-- ============================================
-- This script removes duplicate employees based on store_id + employee_id
-- Keeps the most recent employee (by created_at or updated_at)
-- ============================================

-- Step 1: Find and list duplicates
-- This query shows all duplicate employees (same store_id + employee_id)
SELECT 
  store_id,
  employee_id,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY COALESCE(updated_at, created_at) DESC) as employee_ids
FROM public.employees
WHERE employee_id IS NOT NULL
  AND store_id IS NOT NULL
GROUP BY store_id, employee_id
HAVING COUNT(*) > 1;

-- Step 2: Delete duplicates, keeping only the most recent one
-- This deletes all but the most recent employee for each store_id + employee_id combination
WITH ranked_employees AS (
  SELECT 
    id,
    store_id,
    employee_id,
    ROW_NUMBER() OVER (
      PARTITION BY store_id, employee_id 
      ORDER BY COALESCE(updated_at, created_at) DESC
    ) as rn
  FROM public.employees
  WHERE employee_id IS NOT NULL
    AND store_id IS NOT NULL
)
DELETE FROM public.employees
WHERE id IN (
  SELECT id FROM ranked_employees WHERE rn > 1
);

-- Step 3: Verify no duplicates remain
SELECT 
  store_id,
  employee_id,
  COUNT(*) as count
FROM public.employees
WHERE employee_id IS NOT NULL
  AND store_id IS NOT NULL
GROUP BY store_id, employee_id
HAVING COUNT(*) > 1;
-- Should return 0 rows if cleanup was successful

-- ============================================
-- CLEANUP COMPLETE
-- ============================================


