# Cleanup Instructions

## Fix Duplicate Function Error

The error `generateInvoiceHTML is defined multiple times` is likely due to a stale build cache.

**Solution:**
1. Stop the dev server (Ctrl+C)
2. Delete the `.next` folder
3. Restart with `npm run dev`

## Why New HTML Generators Were Created

**Reason:** The HTML generators in route files (`app/api/invoices/[id]/html/route.ts`) are **server-side only** and cannot be imported in client-side code. 

For **offline mode**, we need HTML generators that work in the browser. That's why we created:
- `lib/utils/invoice-html-generator.ts` - Works on both server AND client
- `lib/utils/invoice-slip-html-generator.ts` - Works on both server AND client

**Benefits:**
- ✅ Single source of truth for HTML templates
- ✅ Works in both online (server) and offline (client) modes
- ✅ Consistent rendering across all methods

## Files to Keep

**Keep these files:**
- `lib/utils/invoice-html-generator.ts` - Shared HTML generator (used by server & client)
- `lib/utils/invoice-slip-html-generator.ts` - Shared HTML generator (used by server & client)
- `lib/utils/invoice-pdf.ts` - Main invoice PDF wrapper (auto-detects online/offline)
- `lib/utils/invoice-slip-pdf.ts` - Main slip PDF wrapper (auto-detects online/offline)
- `lib/utils/invoice-pdf-client.ts` - Client-side PDF generator (offline mode)
- `lib/utils/invoice-slip-pdf-client.ts` - Client-side PDF generator (offline mode)
- `lib/utils/pdf-generator.ts` - Only exports InvoiceData interface (needed)

**Files that can be removed (if unused):**
- Check if `lib/utils/invoice-pdf-sync.ts` is used anywhere
- Check if any old PDF generator files exist

## WhatsApp Flow

Both pages now:
1. ✅ Wait for PDF upload to complete
2. ✅ Use R2 link in WhatsApp message
3. ✅ Open WhatsApp after upload completes
4. ✅ Use the same `shareOnWhatsApp` function

