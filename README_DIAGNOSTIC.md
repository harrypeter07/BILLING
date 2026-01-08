# Supabase Sync Diagnostic Tools

## Quick Test (Browser Console)

1. Open your app in browser
2. Open Developer Console (F12)
3. Copy and paste the code from `scripts/test-supabase-sync-simple.js` into console
4. Press Enter

This will test:
- ✅ Employee session
- ✅ Store access
- ✅ Products access
- ✅ Customers access
- ❌ Show RLS errors if any

## Full Diagnostic Script (Node.js)

### Setup

1. Install dependencies:
```bash
npm install @supabase/supabase-js dotenv
```

2. Make sure `.env.local` has:
```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (optional)
```

### Run

```bash
node scripts/test-supabase-sync.js
```

### What It Tests

1. ✅ Admin authentication (uses provided credentials)
2. ✅ Admin stores
3. ✅ Employees (checks for store_id)
4. ✅ Products (checks store_id and user_id)
5. ✅ Customers (checks store_id and user_id)
6. ✅ Employee access via anon key (RLS test)
7. ✅ Business settings (database_mode check)
8. ✅ RLS policy validation

### Output

The script will show:
- ✅ Green checkmarks for working features
- ❌ Red X for errors
- ⚠️ Yellow warnings for issues
- ℹ️ Blue info for details

### Common Issues Found

1. **Employees missing store_id**
   - Fix: Update employees table to set store_id
   
2. **RLS policy blocking employee access**
   - Fix: Run `scripts/employee-access-products-customers-rls.sql`
   
3. **Products/Customers missing store_id**
   - Fix: Admin needs to create new products/customers with store_id
   
4. **Database mode not set**
   - Fix: Admin switches to Supabase mode in settings

## Manual SQL Checks

### Check Employee Setup
```sql
SELECT 
  e.id,
  e.employee_id,
  e.name,
  e.store_id,
  s.name as store_name,
  s.admin_user_id
FROM employees e
LEFT JOIN stores s ON s.id = e.store_id
WHERE e.user_id = 'YOUR_ADMIN_USER_ID';
```

### Check Products/Customers for Store
```sql
-- Products
SELECT COUNT(*) as product_count
FROM products
WHERE user_id = 'YOUR_ADMIN_USER_ID'
  AND store_id = 'STORE_ID';

-- Customers  
SELECT COUNT(*) as customer_count
FROM customers
WHERE user_id = 'YOUR_ADMIN_USER_ID'
  AND store_id = 'STORE_ID';
```

### Check RLS Policies
```sql
-- Check if policies exist
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE tablename IN ('products', 'customers', 'stores')
ORDER BY tablename, policyname;
```

## Fixes

### If Employees Can't See Products/Customers

1. **Run RLS Migration:**
   ```sql
   -- Execute scripts/employee-access-products-customers-rls.sql
   ```

2. **Assign Store to Employees:**
   ```sql
   UPDATE employees
   SET store_id = 'STORE_ID_HERE'
   WHERE store_id IS NULL
     AND user_id = 'ADMIN_USER_ID';
   ```

3. **Ensure Products/Customers Have store_id:**
   ```sql
   -- Update existing products
   UPDATE products
   SET store_id = 'STORE_ID_HERE'
   WHERE user_id = 'ADMIN_USER_ID'
     AND store_id IS NULL;
   
   -- Update existing customers
   UPDATE customers
   SET store_id = 'STORE_ID_HERE'
   WHERE user_id = 'ADMIN_USER_ID'
     AND store_id IS NULL;
   ```



