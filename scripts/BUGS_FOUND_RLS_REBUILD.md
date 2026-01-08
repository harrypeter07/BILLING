# Bugs Found During RLS Rebuild Review

## 🔴 CRITICAL BUGS (Must Fix)

### 1. **Invoice Creation: `store_id` Can Be Undefined** ✅ FIXED

**Location**: `components/features/invoices/invoice-form.tsx` lines 1031, 1435

**Issue**:

```typescript
store_id: storeId || undefined,
```

**Problem**: After making `store_id` NOT NULL in the database, this will cause inserts to fail when `storeId` is null/undefined.

**Fix Applied**: Added validation before invoice creation to ensure `storeId` is present. If missing, shows error toast and returns early.

---

### 2. **PDF Generation API: Doesn't Handle Employees** ✅ FIXED

**Location**: `app/api/invoices/generate-pdf-and-upload/route.ts` line 81

**Issue**:

```typescript
const {
	data: { user },
} = await supabase.auth.getUser();
if (!user) {
	throw new Error("Not authenticated");
}
```

**Problem**: Employees don't have Supabase auth sessions, so this will always fail for employees. The API route needs to handle employee context.

**Fix Applied**:

- Fetch invoice first to get `user_id` (which is admin_user_id for employees)
- Use `invoice.user_id` as fallback if no auth user
- Verify authorization via store relationship for admins
- All subsequent operations use `userId` instead of `user.id`

---

### 3. **Invoice PDF Sync: Employee Auth Check Fails** ✅ FIXED

**Location**: `lib/utils/invoice-pdf-sync.ts` line 237

**Issue**:

```typescript
const {
	data: { user },
} = await supabase.auth.getUser();
if (user) {
	// Fetch settings...
}
```

**Problem**: Employees don't have auth, so settings won't be fetched. This might be OK (settings are optional), but the code should handle employee context.

**Fix Applied**: Use `invoice.user_id` as fallback if no auth user. This ensures employees can fetch settings using their store's admin_user_id.

---

### 4. **Sync Manager: Doesn't Handle Employees**

**Location**: `lib/sync/sync-manager.ts` lines 139-180

**Issue**: All sync operations use `user.id` from `supabase.auth.getUser()`, which will be null for employees.

**Problem**:

- `pullRemoteChanges()` will fail for employees
- `syncItem()` operations might fail if they rely on user context

**Fix Required**:

- Check for employee session
- Use admin_user_id from store for employees
- Ensure RLS policies allow the sync operations

---

## ⚠️ MEDIUM PRIORITY BUGS

### 5. **Invoice PDF Sync: `store_id` Can Be Null**

**Location**: `lib/utils/invoice-pdf-sync.ts` line 92

**Issue**:

```typescript
store_id: invoice.store_id || null,
```

**Problem**: After making `store_id` NOT NULL, this will fail if syncing an old invoice without `store_id`. However, this is for IndexedDB sync, so it might be acceptable if we ensure all new invoices have `store_id`.

**Fix Required**:

- Ensure all invoices created have `store_id`
- For legacy invoices without `store_id`, either:
  - Set a default store_id
  - Skip syncing (if not critical)
  - Update legacy invoices to have store_id

---

### 6. **Invoice Sequences RLS: Admin Access**

**Location**: `scripts/rebuild-invoice-rls-20260108.sql` line 91-101

**Issue**: The policy checks:

```sql
EXISTS (
  SELECT 1
  FROM public.stores s
  WHERE s.id = invoice_sequences.store_id
    AND s.admin_user_id = auth.uid()
)
OR
EXISTS (
  SELECT 1
  FROM public.employees e
  WHERE e.store_id = invoice_sequences.store_id
)
```

**Problem**: This should work, but verify that admins can access sequences for their stores. The first EXISTS should handle admins.

**Status**: Likely OK, but needs testing.

---

## ✅ WORKING CORRECTLY

### 7. **Invoice Form: Store ID Verification**

**Location**: `components/features/invoices/invoice-form.tsx` lines 1543-1573

**Status**: ✅ Good - The code verifies that `store.admin_user_id === adminUserId` before insert. This is excellent defensive programming.

---

### 8. **Invoice Number Generation: RLS Handling**

**Location**: `lib/utils/invoice-number-supabase.ts`

**Status**: ✅ Good - The code handles RLS errors gracefully and has fallback logic. It checks for RLS errors and provides helpful error messages.

---

### 9. **Product/Customer Fetching: Store Scoping**

**Location**: `lib/hooks/use-cached-data.ts`

**Status**: ✅ Good - The code properly handles employee context and fetches admin_user_id from store. Store filtering is applied correctly.

---

## 📋 TESTING CHECKLIST

After fixing bugs, verify:

- [ ] Employee can create invoice (store_id is set)
- [ ] Admin can create invoice (store_id is set)
- [ ] Invoice number increments correctly for employees
- [ ] Invoice number increments correctly for admins
- [ ] PDF generation works for employees
- [ ] PDF generation works for admins
- [ ] R2 upload works for employees
- [ ] R2 upload works for admins
- [ ] WhatsApp link works
- [ ] Employees cannot access other stores' data
- [ ] Admins cannot access other admins' data
- [ ] Sync manager works for employees (if used)
- [ ] Sync manager works for admins

---

## 🔧 RECOMMENDED FIXES ORDER

1. **Fix Bug #1** (store_id undefined) - CRITICAL for invoice creation
2. **Fix Bug #2** (PDF API employee handling) - CRITICAL for PDF flow
3. **Fix Bug #3** (PDF sync employee handling) - Important for PDF generation
4. **Fix Bug #4** (Sync manager) - Important if sync is used
5. **Fix Bug #5** (Legacy store_id) - Low priority, handle as needed

---

## 📝 NOTES

- The RLS policies themselves look correct based on the verification query results
- The main issues are in the application code not properly handling employee context
- All fixes should maintain backward compatibility with admin users
- Test thoroughly with both admin and employee accounts
