# Database Mode Sync Fix - Summary

## Problem
Employees were seeing wrong database mode (IndexedDB) even when admin switched to Supabase mode, causing:
- Employees couldn't see products/customers saved by admin
- Header showed wrong DB mode
- Data fetching from wrong database

## Root Cause
1. `isIndexedDbMode()` checks `localStorage.getItem('databaseType')` synchronously
2. Employees don't have the same localStorage as admin
3. All hooks and forms were using synchronous mode detection
4. Employees couldn't read admin's `business_settings` due to RLS policy

## Fixes Applied

### 1. Database Mode Inheritance
- **File**: `lib/utils/db-mode.ts`
- Added `getActiveDbModeAsync()` - async function that:
  - For employees: Fetches admin's `database_mode` from `business_settings` via store
  - For admin: Uses localStorage and syncs to `business_settings`
- Added cache with 2-second TTL for performance
- Added `clearDatabaseModeCache()` to force refresh when admin switches

### 2. Updated All Data Hooks
- **File**: `lib/hooks/use-cached-data.ts`
- Changed all hooks to use `getActiveDbModeAsync()` instead of `isIndexedDbMode()`:
  - `useCustomers()` ✅
  - `useProducts()` ✅
  - `useInvoices()` ✅
  - `useEmployees()` ✅
  - `useStores()` ✅
  - `useStore()` ✅
  - `useEmployee()` ✅
  - `useCustomer()` ✅
  - `useProduct()` ✅
  - `useInvoice()` ✅

### 3. Updated Forms
- **Files**: 
  - `components/features/products/product-form.tsx`
  - `components/features/customers/customer-form.tsx`
  - `app/(dashboard)/invoices/new/page.tsx`
- All forms now use async mode detection when saving/loading data

### 4. RLS Policy Fix
- **File**: `scripts/business-settings-employee-access-migration.sql`
- Added policy allowing employees to read their admin's `business_settings`
- Policy checks: Employee belongs to store → Store owned by admin → Can read admin's settings

### 5. Admin Settings Sync
- **File**: `app/(dashboard)/settings/page.tsx`
- When admin switches DB mode:
  - Saves to `localStorage` (for admin)
  - Saves to `business_settings.database_mode` (for employee inheritance)
  - Clears cache to force immediate update

### 6. Header Real-time Updates
- **File**: `components/layout/header.tsx`
- Fetches DB mode and B2B mode asynchronously for employees
- Refreshes every 3 seconds for real-time sync
- Added error handling and logging

## Database Migrations Required

1. **`scripts/db-mode-sync-migration.sql`**
   - Adds `database_mode` column to `business_settings`

2. **`scripts/business-settings-employee-access-migration.sql`**
   - Adds RLS policy for employees to read admin's `business_settings`

## How It Works Now

### Admin Flow:
1. Admin switches to Supabase mode in Settings
2. `localStorage.databaseType` = 'supabase'
3. `business_settings.database_mode` = 'supabase' (saved)
4. Cache cleared

### Employee Flow:
1. Employee logs in
2. `getActiveDbModeAsync()` detects employee session
3. Gets `storeId` from employee session
4. Fetches `stores.admin_user_id` from store
5. Fetches `business_settings.database_mode` for admin_user_id
6. Returns 'supabase' (inherited from admin)
7. All hooks use this mode → Fetch from Supabase ✅

### Data Sharing:
- Products/Customers saved with `store_id` ✅
- Employees query by `admin_user_id` + `store_id` ✅
- All data shared across admin and employees in same store ✅

## Testing Checklist

- [ ] Run both migrations
- [ ] Admin switches to Supabase mode
- [ ] Employee header shows "DB: Supabase" (not IndexedDB)
- [ ] Employee can see products saved by admin
- [ ] Employee can see customers saved by admin
- [ ] Employee can create products/customers (saved to Supabase)
- [ ] Admin can see products/customers created by employees
- [ ] B2B mode shows correctly for employees


