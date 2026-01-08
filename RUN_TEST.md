# How to Run Employee KI19 Invoice Test

## Quick Start

### Option 1: With Environment Variable (Easiest)

1. **Get your Supabase Anon Key:**
   - Go to: https://supabase.com/dashboard
   - Select your project
   - Go to: Settings → API
   - Copy the "anon public" key

2. **Set environment variable and run:**
   ```powershell
   $env:NEXT_PUBLIC_SUPABASE_ANON_KEY="your_anon_key_here"
   node scripts/test-ki19-simple.js
   ```

### Option 2: Interactive (Script will prompt)

```powershell
node scripts/test-ki19-simple.js
```
Then enter your anon key when prompted.

### Option 3: Full Script with Arguments

```powershell
node scripts/test-employee-ki19-invoice.js --url "https://rvtjiswpymvptlzbtydf.supabase.co" --key "your_anon_key"
```

## Expected Output

### ✅ Success Output:
```
======================================================================
🧪 Employee KI19 Invoice Creation Test
======================================================================

✅ Using Supabase URL: https://rvtjiswpymvptlzbtydf.supabase.co
✅ Using Anon Key: eyJhbGciOiJIUzI1NiIsInR...

📝 Step 1: Authenticating as admin...
✅ Admin authenticated: hassanmansuri379@gmail.com
   Admin User ID: 3babf88a-89a9-4e4b-a844-cdce52b5e618

📝 Step 2: Finding employee KI19...
✅ Found employee: KI19
   Store ID: <store-id>

📝 Step 3: Getting store information...
✅ Store: <store-name>
   Admin User ID: 3babf88a-89a9-4e4b-a844-cdce52b5e618

📝 Step 4: Getting customer...
✅ Customer: <customer-name>

📝 Step 5: Testing invoice insert (simulating employee with anon key)...
✅ Invoice created: test-<timestamp>

======================================================================
✅ ALL TESTS PASSED!
✅ RLS is correctly configured for employees
======================================================================
```

### ❌ If RLS is NOT Fixed:
```
❌ INVOICE INSERT FAILED!
   Error: new row violates row-level security policy for table "invoices"
   Code: 42501

🔴 RLS POLICY IS BLOCKING!

🔧 FIX REQUIRED:
   1. Open Supabase Dashboard → SQL Editor
   2. Run: scripts/APPLY_RLS_FIX_NOW.sql
   3. Run this test again
```

## What the Test Does

1. ✅ Authenticates as admin
2. ✅ Finds employee KI19
3. ✅ Gets employee's store information
4. ✅ Gets or creates a test customer
5. ✅ **Tests invoice insert using anon key (simulating employee)**
6. ✅ Cleans up test data

## If Test Fails

1. **Check if RLS fix was applied:**
   - Go to Supabase SQL Editor
   - Run: `scripts/APPLY_RLS_FIX_NOW.sql`
   - Verify it ran successfully

2. **Check employee data:**
   - Employee KI19 must have `store_id` set
   - Store must have `admin_user_id` set

3. **Check Supabase credentials:**
   - Make sure anon key is correct
   - Make sure URL is correct

## Files

- `scripts/test-ki19-simple.js` - Interactive test (recommended)
- `scripts/test-employee-ki19-invoice.js` - Full test with arguments

