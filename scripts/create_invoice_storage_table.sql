-- Create invoice_storage table for R2 metadata
-- This table stores only metadata, NOT binary PDF data

CREATE TABLE IF NOT EXISTS public.invoice_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  r2_object_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_invoice_storage_invoice_id ON public.invoice_storage(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_storage_expires_at ON public.invoice_storage(expires_at);
CREATE INDEX IF NOT EXISTS idx_invoice_storage_r2_object_key ON public.invoice_storage(r2_object_key);

-- IndexedDB schema (for offline-first)
-- This will be added to lib/db/dexie.ts

