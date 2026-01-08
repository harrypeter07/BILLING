# Invoice Number Generation Fix

## Problem
The `generateInvoiceNumber` function was hardcoded to use IndexedDB, causing "Store not found" errors when:
- The system was in Supabase mode
- The store didn't exist in IndexedDB (for employees using Supabase mode)

## Solution
Made `generateInvoiceNumber` automatically detect the database mode and use the appropriate method:

1. **Automatic DB Mode Detection**: Uses `getActiveDbModeAsync()` to determine current mode
2. **Mode-based Routing**:
   - **Supabase mode**: Delegates to `generateInvoiceNumberSupabase()`
   - **IndexedDB mode**: Uses local IndexedDB
3. **Employee Support**: Fixed `generateInvoiceNumberSupabase()` to work with employees (removed `auth.getUser()` check)

## Changes Made

### `lib/utils/invoice-number.ts`
- Added automatic DB mode detection
- Routes to Supabase function if in Supabase mode
- Maintains backward compatibility with IndexedDB mode

### `lib/utils/invoice-number-supabase.ts`
- Removed `auth.getUser()` requirement (allows employees)
- Changed `.single()` to `.maybeSingle()` for better error handling
- Added proper error handling for store fetch failures

### `components/features/invoices/invoice-form.tsx`
- Simplified invoice number generation logic
- Removed manual DB mode check (now handled automatically)
- Added error handling with fallback to simple format

## Benefits
- ✅ Works for both admins and employees
- ✅ Works in both Supabase and IndexedDB modes
- ✅ No manual mode checking needed in components
- ✅ Better error handling and fallback behavior

## Testing
The invoice number generation now works correctly:
- ✅ Admin in Supabase mode
- ✅ Admin in IndexedDB mode  
- ✅ Employee in Supabase mode (inherits admin's mode)
- ✅ Employee in IndexedDB mode

