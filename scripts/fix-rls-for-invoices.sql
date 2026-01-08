-- ===============================================
-- BILLINGSOLUTION: INVOICES & EMPLOYEES CORRECT RLS RE-IMPLEMENTATION
-- ===============================================
-- ⚠️ This migration is critical. Review every section and run in psql or Supabase SQL editor.

-- === STEP 1: ENFORCE store_id PRESENCE ===
ALTER TABLE public.invoices
  ALTER COLUMN store_id SET NOT NULL;

-- === STEP 2: ENABLE RLS ===
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

-- === STEP 3: invoices POLICIES ===
DROP POLICY IF EXISTS "Admins and employees can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins and employees can manage invoices" ON public.invoices;

CREATE POLICY "Admins and employees can insert invoices"
ON public.invoices
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.stores s ON s.id = e.store_id
    WHERE s.admin_user_id = invoices.user_id
      AND e.store_id = invoices.store_id
  )
);

CREATE POLICY "Admins and employees can manage invoices"
ON public.invoices
FOR ALL
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.store_id = invoices.store_id
  )
);

-- === STEP 4: invoice_items POLICIES ===
DROP POLICY IF EXISTS "Employees and admins manage invoice items" ON public.invoice_items;

CREATE POLICY "Employees and admins manage invoice items"
ON public.invoice_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.stores s ON s.id = i.store_id
    LEFT JOIN public.employees e ON e.store_id = s.id
    WHERE i.id = invoice_items.invoice_id
      AND (
        i.user_id = auth.uid()
        OR s.admin_user_id = i.user_id
      )
  )
)
WITH CHECK (TRUE);

-- === STEP 5: invoice_sequences POLICIES ===
DROP POLICY IF EXISTS "Employees manage invoice sequences" ON public.invoice_sequences;

CREATE POLICY "Employees manage invoice sequences"
ON public.invoice_sequences
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    JOIN public.employees e ON e.store_id = s.id
    WHERE s.id = invoice_sequences.store_id
  )
);

-- === STEP 6: Products and Customers STRICT STORE SCOPE ===
DROP POLICY IF EXISTS "Employees read store products" ON public.products;
CREATE POLICY "Employees read store products"
ON public.products
FOR SELECT
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.store_id = products.store_id
  )
);

DROP POLICY IF EXISTS "Employees read store customers" ON public.customers;
CREATE POLICY "Employees read store customers"
ON public.customers
FOR SELECT
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.store_id = customers.store_id
  )
);

-- === 🧪 Verification ===
-- For audit, run:
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename IN ('invoices', 'invoice_items', 'invoice_sequences') ORDER BY tablename, policyname;
