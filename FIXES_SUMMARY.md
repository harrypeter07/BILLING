# Fixes Summary

## Issue 1: Missing 'city' Column in Customers Table

**Error**: "Could not find the 'city' column of 'customers' in the schema cache"

**Root Cause**: The `customers` table schema doesn't have `city`, `state`, and `pincode` columns that are required for B2B invoices.

**Fix**: 
1. Created migration script: `scripts/add-customer-b2b-columns.sql`
2. Updated `components/features/invoices/invoice-form.tsx` to conditionally include B2B fields
3. Updated `app/api/customers/route.ts` to handle B2B fields

**Action Required**: Run the SQL migration in Supabase SQL Editor:
```sql
-- Run: scripts/add-customer-b2b-columns.sql
```

## Issue 2: Invoice Sequence Duplicate Key Error

**Error**: "duplicate key value violates unique constraint 'invoice_sequences_pkey' (Code: 23505)"

**Root Cause**: Race condition - multiple requests trying to create the same sequence record simultaneously.

**Fix**: 
1. Updated `lib/utils/invoice-number-supabase.ts` to use `upsert` instead of `insert`
2. Added duplicate key error handling with retry logic
3. Falls back to timestamp-based sequence if all else fails

**Status**: ✅ Fixed - No action required

## Issue 3: Supabase Storage RLS Error

**Error**: "new row violates row-level security policy"

**Root Cause**: Storage bucket `invoice-pdfs` doesn't have RLS policies configured.

**Fix**:
1. Created storage RLS setup script: `scripts/setup-supabase-storage-rls.sql`
2. Enhanced error handling in `app/api/invoices/upload-supabase/route.ts`
3. Added detailed RLS error modal for storage errors

**Action Required**: 
1. Create storage bucket `invoice-pdfs` in Supabase Dashboard (if not exists)
2. Run the SQL migration: `scripts/setup-supabase-storage-rls.sql`

## Issue 4: Customer Creation RLS Error

**Error**: "new row violates row-level security policy" when creating customers

**Root Cause**: RLS policy for customer INSERT was too restrictive.

**Fix**:
1. Created RLS fix script: `scripts/fix-customer-insert-rls.sql`
2. Added detailed RLS error modal with diagnostics
3. Enhanced error handling in `components/features/invoices/invoice-form.tsx`

**Action Required**: Run the SQL migration:
```sql
-- Run: scripts/fix-customer-insert-rls.sql
```

## All SQL Scripts to Run

Run these in order in Supabase SQL Editor:

1. `scripts/add-customer-b2b-columns.sql` - Adds city, state, pincode columns
2. `scripts/fix-customer-insert-rls.sql` - Fixes customer INSERT RLS policy
3. `scripts/setup-supabase-storage-rls.sql` - Sets up storage bucket RLS policies

## Testing Checklist

After running the migrations:

- [ ] Create customer from invoice page (admin)
- [ ] Create customer from invoice page (employee)
- [ ] Create invoice with new customer (should auto-create customer)
- [ ] Upload PDF to Supabase Storage (via WhatsApp share)
- [ ] Generate invoice number (should not show duplicate key error)
