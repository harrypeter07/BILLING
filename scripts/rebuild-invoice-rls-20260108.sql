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

-- STEP 3: invoices policies
CREATE POLICY "Admins and employees can insert invoices"
ON public.invoices
FOR INSERT
WITH CHECK (
  -- Admin inserting own invoice
  auth.uid() = user_id

  OR

  -- Employee inserting invoice for their store's admin
  EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.stores s ON s.id = e.store_id
    WHERE
      s.admin_user_id = invoices.user_id
      AND e.store_id = invoices.store_id
  )
);

CREATE POLICY "Admins and employees manage invoices"
ON public.invoices
FOR ALL
USING (
  -- Admin
  auth.uid() = user_id

  OR

  -- Employee scoped to store
  EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.store_id = invoices.store_id
  )
);

-- STEP 4: invoice_items policies (inherit invoice authority)
CREATE POLICY "Admins and employees manage invoice items"
ON public.invoice_items
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    JOIN public.stores s ON s.id = i.store_id
    LEFT JOIN public.employees e ON e.store_id = s.id
    WHERE
      i.id = invoice_items.invoice_id
      AND (
        i.user_id = auth.uid()
        OR s.admin_user_id = i.user_id
      )
  )
)
WITH CHECK (TRUE);

-- STEP 5: invoice_sequences (required for numbering)
CREATE POLICY "Employees manage invoice sequences"
ON public.invoice_sequences
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.stores s
    JOIN public.employees e ON e.store_id = s.id
    WHERE s.id = invoice_sequences.store_id
  )
);

-- STEP 6: products & customers (store scoped reads)
CREATE POLICY "Employees read store products"
ON public.products
FOR SELECT
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.store_id = products.store_id
  )
);

CREATE POLICY "Employees read store customers"
ON public.customers
FOR SELECT
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.store_id = customers.store_id
  )
);

-- STEP 7: Verification
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
