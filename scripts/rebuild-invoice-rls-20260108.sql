-- ============================================
-- REBUILD RLS FOR INVOICES + RELATED TABLES
-- ============================================
-- Run this in Supabase SQL Editor.
-- Follows the store-mediated authority model:
-- employee -> employees.store_id -> stores.id -> stores.admin_user_id -> invoices.user_id
-- ============================================

-- STEP 1: Enforce store context on invoices
ALTER TABLE public.invoices
  ALTER COLUMN store_id SET NOT NULL;

-- STEP 2: Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

-- Clean slate: drop existing policies on affected tables
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('invoices', 'invoice_items', 'invoice_sequences', 'products', 'customers')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', p.policyname, p.tablename);
  END LOOP;
END$$;

-- STEP 3: invoices policies (shared between admin & employees)
CREATE POLICY "Store members insert invoices"
ON public.invoices
FOR INSERT
WITH CHECK (
  -- Admin inserting for own store
  auth.uid() = user_id

  OR

  -- Employee inserting for their store
  EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.stores s ON s.id = e.store_id
    WHERE
      e.store_id = invoices.store_id
      AND s.admin_user_id = invoices.user_id
  )
);

CREATE POLICY "Store members manage invoices"
ON public.invoices
FOR ALL
USING (
  -- Admin
  auth.uid() = user_id

  OR

  -- Employees: invoices from their store's admin (matching user_id AND store_id)
  EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.stores s ON s.id = e.store_id
    WHERE 
      -- Invoice belongs to employee's admin
      invoices.user_id = s.admin_user_id
      AND (
        -- Invoice has matching store_id
        invoices.store_id = e.store_id
        OR
        -- Invoice has NULL store_id (legacy data, shared with all employees of that admin)
        invoices.store_id IS NULL
      )
  )
);

-- STEP 4: invoice_items policies (follow invoice visibility)
CREATE POLICY "Store members manage invoice items"
ON public.invoice_items
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE
      i.id = invoice_items.invoice_id
      AND (
        -- Admin sees own invoices
        i.user_id = auth.uid()
        OR
        -- Employees see invoices from their store
        EXISTS (
          SELECT 1
          FROM public.employees e
          WHERE e.store_id = i.store_id
        )
      )
  )
)
WITH CHECK (TRUE);

-- STEP 5: invoice_sequences (shared counter per store)
CREATE POLICY "Store members manage invoice sequences"
ON public.invoice_sequences
FOR ALL
USING (
  -- Admin accessing own store's sequences
  EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = invoice_sequences.store_id
      AND s.admin_user_id = auth.uid()
  )
  OR
  -- Employees accessing their store's sequences
  EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.store_id = invoice_sequences.store_id
  )
);

-- STEP 6: products (shared store catalog)
CREATE POLICY "Store members read products"
ON public.products
FOR SELECT
USING (
  -- Admin
  auth.uid() = user_id

  OR

  -- Employees: products from their store's admin (matching user_id AND store_id)
  EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.stores s ON s.id = e.store_id
    WHERE 
      -- Product belongs to employee's admin
      products.user_id = s.admin_user_id
      AND (
        -- Product has matching store_id
        products.store_id = e.store_id
        OR
        -- Product has NULL store_id (legacy data, shared with all employees of that admin)
        products.store_id IS NULL
      )
  )
);

-- Products INSERT policy (admins and employees can create products)
CREATE POLICY "Store members insert products"
ON public.products
FOR INSERT
WITH CHECK (
  -- Admin inserting own product
  auth.uid() = user_id

  OR

  -- Employee inserting product for their store's admin
  -- Check that the product's user_id matches any store's admin_user_id where an employee exists
  EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.stores s ON s.id = e.store_id
    WHERE 
      -- Product's user_id matches store's admin_user_id
      s.admin_user_id = products.user_id
      AND (
        -- Product's store_id matches employee's store_id
        products.store_id = e.store_id
        OR
        -- Product's store_id is NULL (allowed for employees)
        products.store_id IS NULL
      )
  )
);

-- Products UPDATE/DELETE policy (admins and employees can manage products)
CREATE POLICY "Store members manage products"
ON public.products
FOR ALL
USING (
  -- Admin
  auth.uid() = user_id

  OR

  -- Employees: products from their store's admin
  EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.stores s ON s.id = e.store_id
    WHERE 
      -- Product belongs to employee's admin
      products.user_id = s.admin_user_id
      AND (
        -- Product has matching store_id
        products.store_id = e.store_id
        OR
        -- Product has NULL store_id (legacy data)
        products.store_id IS NULL
      )
  )
)
WITH CHECK (
  -- Same check for updates
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.stores s ON s.id = e.store_id
    WHERE 
      s.admin_user_id = products.user_id
      AND (
        products.store_id = e.store_id
        OR
        products.store_id IS NULL
      )
  )
);

-- STEP 7: customers (shared store customers)
CREATE POLICY "Store members read customers"
ON public.customers
FOR SELECT
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.stores s ON s.id = e.store_id
    WHERE 
      -- Customer belongs to employee's admin
      customers.user_id = s.admin_user_id
      AND (
        -- Customer has matching store_id
        customers.store_id = e.store_id
        OR
        -- Customer has NULL store_id (legacy data, shared with all employees of that admin)
        customers.store_id IS NULL
      )
  )
);

-- Customers INSERT policy (admins and employees can create customers)
CREATE POLICY "Store members insert customers"
ON public.customers
FOR INSERT
WITH CHECK (
  -- Admin inserting own customer
  auth.uid() = user_id

  OR

  -- Employee inserting customer for their store's admin
  -- Check that the customer's user_id matches any store's admin_user_id where an employee exists
  EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.stores s ON s.id = e.store_id
    WHERE 
      -- Customer's user_id matches store's admin_user_id
      s.admin_user_id = customers.user_id
      AND (
        -- Customer's store_id matches employee's store_id
        customers.store_id = e.store_id
        OR
        -- Customer's store_id is NULL (allowed for employees)
        customers.store_id IS NULL
      )
  )
);

-- Customers UPDATE/DELETE policy (admins and employees can manage customers)
CREATE POLICY "Store members manage customers"
ON public.customers
FOR ALL
USING (
  -- Admin
  auth.uid() = user_id

  OR

  -- Employees: customers from their store's admin
  EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.stores s ON s.id = e.store_id
    WHERE 
      -- Customer belongs to employee's admin
      customers.user_id = s.admin_user_id
      AND (
        -- Customer has matching store_id
        customers.store_id = e.store_id
        OR
        -- Customer has NULL store_id (legacy data)
        customers.store_id IS NULL
      )
  )
)
WITH CHECK (
  -- Same check for updates
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.stores s ON s.id = e.store_id
    WHERE 
      s.admin_user_id = customers.user_id
      AND (
        customers.store_id = e.store_id
        OR
        customers.store_id IS NULL
      )
  )
);

-- STEP 8: Verification
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN (
  'invoices',
  'invoice_items',
  'invoice_sequences',
  'products',
  'customers'
)
ORDER BY tablename, policyname;
