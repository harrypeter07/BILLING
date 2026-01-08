# Employee Setup Guide

## Using Existing Employees

**Yes, existing employees will work!** No need to create new ones, but you need to verify a few things:

### Prerequisites for Employees to Work

1. **Employee must have `store_id` set**
   - Check in Supabase: `employees` table → `store_id` column
   - If `store_id` is `NULL`, the employee won't be able to see products/customers

2. **Store must have `admin_user_id` set**
   - Check in Supabase: `stores` table → `admin_user_id` column
   - This links the store to the admin who owns it

3. **Admin must have products/customers with matching `store_id`**
   - Products: `products` table → `user_id` = admin's user_id, `store_id` = employee's store_id
   - Customers: `customers` table → `user_id` = admin's user_id, `store_id` = employee's store_id

### How to Fix Existing Employees

If an employee can't see data, run this SQL in Supabase to check:

```sql
-- Check if employee has store_id
SELECT id, employee_id, name, store_id 
FROM employees 
WHERE employee_id = 'YOUR_EMPLOYEE_ID';

-- If store_id is NULL, update it:
UPDATE employees 
SET store_id = 'STORE_ID_HERE' 
WHERE employee_id = 'YOUR_EMPLOYEE_ID';

-- Verify store exists and has admin_user_id
SELECT id, name, store_code, admin_user_id 
FROM stores 
WHERE id = 'STORE_ID_HERE';
```

### Error Messages (Toast Notifications)

The app now shows user-friendly error messages when:
- ❌ **"Unable to fetch store information"** - Employee's store not found or incomplete
- ❌ **"Store information is incomplete"** - Store exists but missing `admin_user_id`
- ❌ **"Unable to load products/customers"** - RLS policy issue or network error
- ❌ **"Store ID not found in employee session"** - Employee needs to log out and log in again
- ❌ **"Employee session not found"** - Session expired or invalid

### Testing Employees

1. Employee logs in with **Employee ID + Password** (no Supabase auth needed)
2. System checks if employee has valid `store_id`
3. System fetches store's `admin_user_id`
4. Employee can see products/customers from their store's admin
5. All data is filtered by `store_id` for security

### Quick Fix Script

If you have employees without `store_id`, run this (after updating with actual values):

```sql
-- Assign employees to a store
UPDATE employees 
SET store_id = 'YOUR_STORE_ID'
WHERE store_id IS NULL 
  AND employee_id IN ('EMP1', 'EMP2', 'EMP3');
```

## Summary

✅ **Old employees work** - just ensure they have `store_id` set  
✅ **Toast notifications** - User-friendly error messages instead of console logs  
✅ **No Supabase auth needed** - Employees authenticate with ID + Password only  
✅ **RLS policies** - Allow employees to read their store's admin data  



