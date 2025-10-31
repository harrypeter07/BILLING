<!-- b101b363-c582-4e0e-a7a2-731777c5e561 4126f996-2e8f-4e40-bf66-9fabb473fff2 -->
# Implementation Plan: Multi-Login System and Invoice Format

## 1. Fix Reports Page for Excel Mode

- **File**: `app/(dashboard)/reports/page.tsx`
- Convert to client component with `getDatabaseType()` check
- When Excel mode: fetch from Dexie (`db.invoices`, `db.products`)
- When Supabase mode: keep existing Supabase queries
- Calculate same metrics for both modes

## 2. Database Schema Updates

### 2.1 Dexie Schema (`lib/dexie-client.ts`)

- Add `Store` interface: `id, name, admin_user_id, store_code (4-char), created_at`
- Add `stores` table to AppDB with index on `store_code`
- Update `Employee`: add `employee_id (4-char), password, store_id`
- Update `Invoice`: add `store_id, employee_id, created_by_employee_id`
- Add `customer_auth` table: `customer_id, email, phone, magic_link_token, token_expires_at`
- Bump DB version to v4

### 2.2 Supabase Schema

- Create migration SQL for:
- `stores` table: `id (UUID), admin_user_id (FK), name, store_code (4-char unique), created_at`
- `employees` table: add columns `employee_id (4-char), password_hash, store_id (FK)`
- `invoices` table: add `store_id (FK), employee_id (FK), invoice_sequence (per day)`
- `customer_auth` table: `customer_id (FK), email, phone, magic_link_token, token_expires_at`

## 3. Store Management

### 3.1 Store Creation Flow

- **File**: `app/(dashboard)/settings/store/page.tsx` (new)
- After admin signup/login, redirect to store creation if no store exists
- Form fields: store name, address, GSTIN, phone
- Generate 4-char `store_code`: first 4 chars of store name (uppercase, alphanumeric) or fallback to UUID first 4
- Save to Dexie (Excel mode) or Supabase (database mode)
- Store code must be unique

### 3.2 Store Selection/Context

- **File**: `lib/utils/store-context.ts` (new)
- Create React context/hook to track current store (for admin/employee)
- Persist in localStorage: `currentStoreId`
- Middleware checks store context

## 4. Employee Management

### 4.1 Employee ID Generation

- **File**: `lib/utils/employee-id.ts` (new)
- Function: `generateEmployeeId(storeId, employeeName)`: 
- Use first 2 chars of store code + 2-digit sequential number (01-99)
- Or use first 3 chars of employee name + 1 digit if sequential unavailable
- Ensure uniqueness within store
- Default password = employee_id (can be changed by admin)

### 4.2 Employee CRUD

- **File**: `app/(dashboard)/employees/[id]/edit/page.tsx`
- Add fields: `employee_id`, `password` (admin can change)
- When creating employee: auto-generate `employee_id`, set password = `employee_id`
- Save `store_id` linking to current store

### 4.3 Employee Login

- **File**: `app/auth/employee-login/page.tsx` (new)
- Form: store name (text input), employee ID (4-char), password
- Validate: lookup employee by `store_id` (via store name) + `employee_id` + password
- On success: create session, set `currentStoreId`, redirect to dashboard
- Session stored in localStorage or Supabase auth (as employee type)

## 5. Invoice Number Format

### 5.1 Invoice Number Generator

- **File**: `lib/utils/invoice-number.ts` (new)
- Format: `STORE4-EMP4-YYYYMMDDHHmmss-SEQ`
- Implementation:
- Get store_code (4-char) from current store context
- Get employee_id (4-char) from logged-in employee or default "ADMN"
- Get current timestamp: `YYYYMMDDHHmmss`
- Get sequence: daily counter per store, reset at midnight, 3 digits (000-999)
- Store sequence in Dexie `invoice_sequences` table or Supabase `invoice_sequences` table (key: `store_id-date`)

### 5.2 Update Invoice Creation

- **File**: `components/features/invoices/invoice-form.tsx`
- Replace invoice number generation to use new format
- Get store_id and employee_id from context/store session
- **File**: `app/(dashboard)/invoices/new/page.tsx`
- Pass store_id and employee_id to InvoiceForm

### 5.3 Storage Manager

- **File**: `lib/storage-manager.ts`
- Update `addInvoice`: generate invoice number using new format
- Store `store_id`, `employee_id` with invoice

## 6. Customer Login (Magic Link)

### 6.1 Customer Magic Link Flow

- **File**: `app/auth/customer-login/page.tsx` (new)
- Form: email input
- On submit: 
- Generate magic link token (random UUID)
- Store in `customer_auth` table with `customer_id` (lookup by email), `token_expires_at` (1 hour)
- Send email via Supabase email or API route (mock for now)
- Show message: "Check your email for login link"
- **File**: `app/auth/customer-verify/[token]/page.tsx` (new)
- Validate token, lookup customer, create session, redirect to customer dashboard

### 6.2 Customer Dashboard

- **File**: `app/(customer)/dashboard/page.tsx` (new route group)
- Fetch invoices where `customer_id` matches logged-in customer
- Display: invoice list, totals, download PDFs
- Middleware: protect `/customer/*` routes, check customer session

### 6.3 Customer Session Management

- **File**: `lib/utils/customer-auth.ts` (new)
- Store customer session in localStorage: `customerAuth: { customerId, email, token }`
- Middleware checks this for customer routes

## 7. Authentication Middleware Updates

### 7.1 Middleware Routes

- **File**: `lib/supabase/middleware.ts`
- Add route detection:
- `/customer/*` → customer auth required
- `/employee/*` → employee auth required (or redirect employee login)
- `/dashboard/*`, `/admin/*` → admin auth required (existing)
- Check appropriate session type per route

### 7.2 Employee Session

- Store in localStorage: `employeeSession: { employeeId, storeId, storeName, employeeName }`
- Or create Supabase user with metadata `{ type: 'employee', employee_id, store_id }`

## 8. Admin Employee Management

### 8.1 Employee Credentials Page

- **File**: `app/(dashboard)/employees/[id]/credentials/page.tsx` (new)
- Admin can view/edit: employee_id, password
- Show "Reset Password" button (sets password = employee_id)
- Update in Dexie or Supabase

## 9. Customer Email/Phone Lookup

### 9.1 Update Customer Model

- Customer already has `email`, `phone` in Dexie and Supabase
- Ensure these are indexed for login lookup
- **File**: `lib/dexie-client.ts` - add index: `customers: "id, email, phone"`

## 10. Testing & Migration

### 10.1 Data Migration

- Script to generate `store_code` for existing stores (if any)
- Script to generate `employee_id` for existing employees
- Update existing invoices: add `store_id`, `employee_id`, regenerate invoice numbers (optional, can be done incrementally)

### 10.2 Route Protection

- Update all dashboard routes to check for appropriate store context
- Customer routes: check customer session
- Employee routes: check employee session + store context

## Files to Create/Modify Summary

**New Files:**

- `app/(dashboard)/settings/store/page.tsx`
- `app/auth/employee-login/page.tsx`
- `app/auth/customer-login/page.tsx`
- `app/auth/customer-verify/[token]/page.tsx`
- `app/(customer)/dashboard/page.tsx`
- `lib/utils/store-context.ts`
- `lib/utils/employee-id.ts`
- `lib/utils/invoice-number.ts`
- `lib/utils/customer-auth.ts`
- `scripts/004_stores_and_employee_auth.sql`

**Modified Files:**

- `app/(dashboard)/reports/page.tsx` - Add Excel mode support
- `lib/dexie-client.ts` - Add stores, update employee/invoice schemas
- `components/features/invoices/invoice-form.tsx` - Use new invoice number format
- `app/(dashboard)/invoices/new/page.tsx` - Pass store/employee context
- `lib/storage-manager.ts` - Store store_id, employee_id with invoices
- `lib/supabase/middleware.ts` - Add customer/employee route protection
- `app/(dashboard)/employees/[id]/edit/page.tsx` - Add employee_id, password fields
- `app/(dashboard)/employees/new/page.tsx` - Auto-generate employee_id
- Customer/Employee listing pages - Show employee_id, store associations