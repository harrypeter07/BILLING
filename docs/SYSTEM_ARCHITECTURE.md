# System Architecture & Flow Documentation

**Last Updated**: 2024  
**Purpose**: Comprehensive guide to database modes, B2B implementation, and system flows

---

## 📌 Table of Contents

1. [Database Modes](#database-modes)
2. [Data Access Layer](#data-access-layer)
3. [B2B vs B2C Implementation](#b2b-vs-b2c-implementation)
4. [PDF & WhatsApp Flow](#pdf--whatsapp-flow)
5. [Verification Checklist](#verification-checklist)

---

## 🗄️ Database Modes

### Overview

The application supports two mutually exclusive database modes:

- **IndexedDB Mode** (`indexeddb`): Offline-first, local-first POS system
- **Supabase Mode** (`supabase`): Cloud-first SaaS system

### Mode Detection

**Centralized Function**: `lib/utils/db-mode.ts`

```typescript
getActiveDbMode(): 'indexeddb' | 'supabase'
```

**Storage**: Mode is stored in `localStorage.databaseType`

### Isolation Rules

**CRITICAL**: Modes must NEVER mix.

| Condition | Allowed |
|-----------|---------|
| Supabase mode | ✅ Supabase only |
| IndexedDB mode | ✅ IndexedDB only |
| Hybrid operations | ❌ **FORBIDDEN** |

### IndexedDB Mode Flow

**When**: `getActiveDbMode() === 'indexeddb'`

**Behavior**:
- All data operations use Dexie (IndexedDB wrapper)
- Data stored locally in browser
- No sync functionality - completely separate from Supabase mode
- Offline-first architecture
- Business settings can be fetched from Supabase (read-only)

**Key Files**:
- `lib/dexie-client.ts` - Dexie database client
- `lib/storage-manager.ts` - CRUD operations wrapper
- Note: Sync functionality has been removed - IndexedDB and Supabase are separate modes

### Supabase Mode Flow

**When**: `getActiveDbMode() === 'supabase'`

**Behavior**:
- All data operations use Supabase client
- Data stored in cloud PostgreSQL
- No IndexedDB access allowed
- Direct API calls to Supabase
- Completely separate from IndexedDB mode - no cross-mode sync

**Key Files**:
- `lib/supabase/client.ts` - Browser Supabase client
- `lib/supabase/server.ts` - Server Supabase client
- API routes in `app/api/*`

### Mode Guard Pattern

Always check mode before database operations:

```typescript
import { getActiveDbMode } from '@/lib/utils/db-mode'

const mode = getActiveDbMode()

if (mode === 'supabase') {
  // Use Supabase
  const supabase = createClient()
  const { data } = await supabase.from('table').select()
} else {
  // Use IndexedDB
  const { db } = await import('@/lib/dexie-client')
  const data = await db.table.toArray()
}
```

---

## 🔌 Data Access Layer

### Repository Pattern

**Current Implementation**: Conditional access based on mode

**Location**: 
- `lib/hooks/use-cached-data.ts` - React hooks for data fetching
- Individual components handle mode switching

### Store ID Enforcement

**Single Source of Truth**: `lib/utils/get-current-store-id.ts`

**Priority**:
1. Employee session `store_id`
2. `localStorage.currentStoreId`
3. First store from admin (fallback)

**Usage**:
```typescript
import { getCurrentStoreId } from '@/lib/utils/get-current-store-id'

const storeId = await getCurrentStoreId()
```

### Query Scoping

All queries filter by:
- `user_id` - Data ownership
- `store_id` - Store isolation (when applicable)

**Example**:
```typescript
// Supabase
supabase.from('products')
  .select('*')
  .eq('user_id', userId)
  .eq('store_id', storeId)

// IndexedDB
db.products
  .where('user_id').equals(userId)
  .and(p => p.store_id === storeId)
```

---

## 🏢 B2B vs B2C Implementation

### Feature Flag

**Storage**: `business_settings.is_b2b_enabled` (boolean)

**Access**:
```typescript
import { getB2BModeStatus } from '@/lib/utils/b2b-mode'

const isB2B = await getB2BModeStatus()
```

### B2B Settings

**Location**: `app/(dashboard)/settings/business/page.tsx`

**Prerequisites for Enabling**:
- Business GSTIN must be set
- Business address must be set

### Validation Differences

#### Customer Form

**B2C Mode**:
- Name: Required
- Phone: Required
- GSTIN: Optional
- Billing Address: Optional

**B2B Mode**:
- Name: Required
- Phone: Required
- **GSTIN: Required** ⚠️
- **Billing Address: Required** ⚠️

**File**: `components/features/customers/customer-form.tsx`

#### Product Form

**B2C Mode**:
- Name: Required
- Price: Required
- HSN Code: Optional
- GST Rate: Optional (defaults to 18%)

**B2B Mode**:
- Name: Required
- Price: Required
- **HSN Code: Required** ⚠️
- **GST Rate: Required (> 0)** ⚠️

**File**: `components/features/products/product-form.tsx`

#### Invoice Form

**B2C Mode**:
- GST Invoice: Toggleable
- Customer GSTIN: Optional
- Tax calculation: Optional

**B2B Mode**:
- **GST Invoice: Forced ON** ⚠️
- Customer GSTIN: Validated (must exist)
- Tax calculation: Required

**File**: `components/features/invoices/invoice-form.tsx`

### Invoice Differences

**B2C Invoice**:
- Simple invoice format
- Tax optional
- No GSTIN validation

**B2B Invoice**:
- "TAX INVOICE" label
- GSTIN displayed (business + customer)
- HSN codes on items
- Tax breakup (CGST/SGST or IGST)
- Place of supply validation

**PDF Generation**: `lib/invoice-document-engine.ts`

### UI Indicators

**Header Badge**: Shows current mode
- `B2B` / `B2C` badge
- `DB: Supabase` / `DB: IndexedDB` badge

**File**: `components/layout/header.tsx`

---

## 📄 PDF & WhatsApp Flow

### PDF Generation

**Unified Engine**: `lib/invoice-document-engine.ts`

**Functions**:
- `executeInvoiceAction()` - Main entry point
- `fetchInvoiceData()` - Mode-aware data fetching
- `prepareInvoiceDocumentData()` - Data normalization

### Flow Diagram

```
User Action (Print/Download/Share)
    ↓
executeInvoiceAction()
    ↓
fetchInvoiceData() [Mode-aware]
    ├─ IndexedDB Mode → Dexie queries
    └─ Supabase Mode → Supabase queries
    ↓
prepareInvoiceDocumentData()
    ↓
Generate PDF (client or server)
    ↓
Action (Print/Download/R2 Upload)
```

### R2 Upload Flow

**Endpoint**: `app/api/invoices/upload-r2/route.ts`

**Process**:
1. PDF generated client-side or server-side
2. PDF converted to Buffer
3. Upload to Cloudflare R2
4. Return R2 URL

**Key File**: `lib/utils/r2-storage.ts`

### WhatsApp Share Flow

**Process**:
1. Generate PDF
2. Upload to R2 (if not already)
3. Get R2 public URL
4. Open WhatsApp with pre-filled message + PDF link

**Key File**: `components/features/invoices/whatsapp-share-button.tsx`

---

## ✅ Verification Checklist

### Database Mode Isolation

- [x] Supabase mode never touches IndexedDB
- [x] IndexedDB mode never touches Supabase for transactional data
- [x] No hidden fallbacks between modes
- [x] All DB operations use mode guards
- [x] Centralized mode detection function

**Verified Files**:
- `components/features/customers/customer-form.tsx` - Fixed IndexedDB access in Supabase mode
- `lib/invoice-document-engine.ts` - Added note about read-only Supabase access for settings
- `lib/utils/db-mode.ts` - Centralized with `getActiveDbMode()`

### B2B Implementation

- [x] B2B toggle exists in settings
- [x] Validation blocks enable if GST data missing
- [x] Customer form: GSTIN mandatory when B2B enabled
- [x] Product form: HSN + GST mandatory when B2B enabled
- [x] Invoice form: GST forced ON when B2B enabled
- [x] Header shows B2B/B2C mode indicator
- [x] PDFs show correct format based on mode

**Verified Files**:
- `app/(dashboard)/settings/business/page.tsx` - B2B toggle with validation
- `components/features/customers/customer-form.tsx` - B2B validation added
- `components/features/products/product-form.tsx` - B2B validation added
- `components/features/invoices/invoice-form.tsx` - B2B enforcement added
- `components/layout/header.tsx` - Mode indicators added

### Stability

- [x] No regression in B2C mode
- [x] No performance hit
- [x] Sync functionality removed - modes are completely separate

---

## 🔧 Common Patterns

### Fetching B2B Status

```typescript
import { getB2BModeStatus } from '@/lib/utils/b2b-mode'

const isB2B = await getB2BModeStatus()
```

### Mode-Aware Data Fetching

```typescript
import { getActiveDbMode } from '@/lib/utils/db-mode'

const mode = getActiveDbMode()

if (mode === 'supabase') {
  // Supabase query
} else {
  // IndexedDB query
}
```

### Store-Scoped Queries

```typescript
import { getCurrentStoreId } from '@/lib/utils/get-current-store-id'

const storeId = await getCurrentStoreId()
// Use storeId in query filters
```

---

## 📝 Notes

- Business settings (profile) are stored in Supabase even in IndexedDB mode (read-only access for PDF generation)
- Mode is determined at runtime from `localStorage.databaseType`
- B2B mode requires business GSTIN and address to be set first
- All forms respect B2B mode and enforce required fields accordingly

---

**End of Documentation**

