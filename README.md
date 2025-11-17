# Billing Solutions - Architecture & Flow Documentation

## Table of Contents
1. [Overview](#overview)
2. [Quick Start Matrix](#quick-start-matrix)
3. [Offline vs Online Flow](#offline-vs-online-flow)
4. [Authentication, Licensing & Admin Provisioning](#authentication-licensing--admin-provisioning)
5. [Application Architecture](#application-architecture)
6. [Directory Structure](#directory-structure)
7. [Application Flow](#application-flow)
8. [Authentication System](#authentication-system)
9. [Data Layer](#data-layer)
10. [Feature Modules](#feature-modules)
11. [Routing & Navigation](#routing--navigation)
12. [State Management](#state-management)
13. [Setup & Configuration](#setup--configuration)
14. [Build & Distribution](#build--distribution)
15. [Known Issues & TODO](#known-issues--todo)

---

## Overview

**Billing Solutions** is a Next.js 16-based billing and invoicing application designed for small businesses. It supports:

- **Dual Database Modes**: Excel (offline-first with Dexie) and Supabase (cloud-based)
- **Multi-User Roles**: Admin, Employee, and Public users
- **Store Management**: Multi-store support with store-specific employees and invoices
- **GST Invoice Generation**: Automated tax calculations and PDF generation
- **Offline-First**: Works without internet, syncs when online
- **PWA Support**: Installable Progressive Web App

---

## Quick Start Matrix

| Scenario | What You Get | Prerequisites | Steps |
| --- | --- | --- | --- |
| **Offline-First (Default)** | Dexie/IndexedDB storage, Excel auto-export, no internet required | Chromium-based browser or packaged Electron build | `npm install && npm run dev`, keep `localStorage.databaseType` unset or `indexeddb`, login with licensed admin |
| **Hybrid (Supabase Cloud)** | Real-time Supabase sync, multi-device access | Supabase project (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), run `scripts/00_complete_setup.sql` | Set `localStorage.databaseType = 'supabase'` (or toggle in settings), run `npm run dev`, login via Supabase |
| **Electron Desktop** | Offline desktop app (.exe/.dmg/AppImage) that bundles Dexie data | Node 18+, platform-specific build tools | `npm install`, `npm run dist:win` / `dist:mac` / `dist:linux`, installer outputs under `dist/` |

---

## Offline vs Online Flow

### Offline (Dexie + Excel)
1. **Data path**: UI → `storageManager` → Dexie tables (`lib/dexie-client.ts`) → Excel auto-export (`lib/excel-auto.ts`) when enabled.
2. **Sync feedback**: Each Dexie write dispatches `sync:saved` with live record counts; `components/sync-status.tsx` renders the “Saved: xP…” banner.
3. **Authentication**:
   - Admins: Supabase credentials cached locally only when “Offline admin login” toggle is ON and a successful online login occurs.
   - Employees: `localStorage.employeeSession` holds store + employee context.
4. **Store context**: `StoreProvider` resolves `currentStoreId` from Dexie (fallback to Supabase if cloud mode).
5. **Network loss**: App keeps working; offline login fallback (see below) prevents forced redirects; manual sync button can push accumulated data later.

### Online (Supabase Cloud)
1. **Data path**: UI → Supabase client or API routes under `app/api/*` → Supabase Postgres w/ RLS.
2. **Session**: Supabase Auth cookies refreshed via middleware; user role fetched from `user_profiles`.
3. **Store discovery**: Dashboard layout checks Dexie first, then Supabase when `localStorage.databaseType === 'supabase'`.
4. **Mode switching**: `localStorage.databaseType` (default `indexeddb`) toggled from `Settings → Database & Sync`; header badge reads “Local” vs “Supabase”.
5. **Hybrid sync**: Even in Supabase mode, Dexie can be used for fast local writes and background sync through `lib/sync/sync-manager`.

---

## Authentication, Licensing & Admin Provisioning

### License Guard (Device Binding)
- Licensing is enforced via Firestore (`components/license-guard.tsx` + `lib/utils/license-manager.ts`).
- Each machine must have a valid license key + MAC address pair before the first admin signs in.
- Use the provisioning script:
  ```bash
  npm run seed:license -- <LICENSE_KEY> <MAC_ADDRESS> "<CLIENT_NAME>" [expiresInDays]
  ```
  - `MAC_ADDRESS`: uppercase, no separators required (e.g., `D45D64012345`); obtain with `getmac` (Windows) or `ifconfig en0` (macOS).
  - Provide Firebase Admin credentials with `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json` or place the JSON under `app/firebase/`.
  - Optional `expiresInDays` defaults to 365.
- Script creates/updates `licenses` documents (status, activation, expiry). Console logs show `[License Seed] ...`.
- At runtime, `LicenseGuard` validates remotely, caches locally, and logs messages such as `[LicenseManager] Stored license is valid locally`.

### Admin Onboarding Flow
1. Seed the license for the target machine.
2. Sign up via `/auth/signup` (Supabase) and verify email.
3. Login through `/auth/login`.
4. Create the first store in `Settings → Store` (required for admin access).
5. Optional: enable **Offline admin login** (in `Settings → Database & Sync`) to cache credentials for offline use.

### Authentication Matrix
| User Type | Auth Mechanism | Storage | Offline Experience | Notes |
| --- | --- | --- | --- | --- |
| Admin/Public | Supabase email/password | Supabase Auth cookies | ✅ (with offline toggle) | Offline login hashes existing credentials locally; Supabase remains source of truth. |
| Employee | Store Code + Employee ID/Password | `localStorage.employeeSession` | ✅ | Validated via `/api/stores` + `/api/employees/lookup` (Supabase) with Dexie fallback. |
| Customer | Email magic link (TODO API) | Supabase | ⚠️ | Placeholder API route; not fully implemented. |

### Offline Admin Login Toggle
1. Enable toggle at `Settings → Database & Sync`.
2. Perform a successful Supabase login to cache hashed credentials + `currentStoreId` locally.
3. When offline, the login form calls `attemptOfflineLogin`; matching hashes grant a 7-day offline session.
4. Logging out or disabling the toggle wipes cached credentials.

---

## Application Architecture

### Technology Stack
- **Framework**: Next.js 16.0.0 (App Router)
- **UI Library**: React 19.2.0
- **Styling**: Tailwind CSS 4.1.9
- **UI Components**: Radix UI primitives with custom components
- **Database (Offline)**: Dexie.js (IndexedDB wrapper)
- **Database (Cloud)**: Supabase (PostgreSQL with Row-Level Security)
- **Form Handling**: React Hook Form with Zod validation
- **State Management**: React Context API + LocalStorage
- **File I/O**: File System Access API (Excel integration)

### Architecture Patterns

1. **Dual-Mode Architecture**: The app switches between Excel/Dexie and Supabase modes based on `localStorage.getItem('databaseType')`
2. **Feature-Based Organization**: Components organized by feature (products, customers, invoices, employees)
3. **API Route Pattern**: Server-side routes in `app/api/` for Supabase operations
4. **Middleware Authentication**: Next.js middleware handles session management via Supabase SSR

---

## Directory Structure

```
billing-solutions/
├── app/                          # Next.js App Router pages
│   ├── (dashboard)/              # Dashboard layout group
│   │   ├── dashboard/            # Main dashboard page
│   │   ├── products/             # Product management
│   │   ├── customers/            # Customer management
│   │   ├── invoices/             # Invoice creation & management
│   │   ├── employees/            # Employee management (Admin only)
│   │   ├── reports/              # Reports & analytics
│   │   ├── settings/             # App settings
│   │   ├── admin/                # Admin-only analytics
│   │   └── layout.tsx            # Dashboard layout with sidebar/header
│   ├── (customer)/               # Customer-facing routes
│   │   └── purchases/            # Customer purchase history
│   ├── api/                      # API routes (Supabase mode)
│   │   ├── products/             # Product CRUD endpoints
│   │   ├── customers/            # Customer CRUD endpoints
│   │   ├── invoices/             # Invoice CRUD endpoints
│   │   ├── employees/            # Employee CRUD endpoints
│   │   ├── excel/                # Excel export/import endpoints
│   │   └── sync/                 # Data sync endpoints
│   ├── auth/                     # Authentication pages
│   │   ├── login/                # Admin/Public login
│   │   ├── signup/               # Admin/Public signup
│   │   ├── employee-login/       # Employee login
│   │   ├── customer-login/       # Customer login
│   │   └── customer-verify/      # Customer email verification
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing page
├── components/
│   ├── features/                 # Feature-specific components
│   │   ├── products/             # Product form & table
│   │   ├── customers/            # Customer form & table
│   │   ├── invoices/             # Invoice form, table, actions
│   │   └── employees/            # Employee form
│   ├── layout/                   # Layout components
│   │   ├── sidebar.tsx           # Navigation sidebar
│   │   └── header.tsx            # Top header bar
│   ├── ui/                       # Reusable UI components (Radix-based)
│   ├── shared/                   # Shared components (empty states, errors)
│   └── settings/                 # Settings components
├── lib/
│   ├── supabase/                 # Supabase client configuration
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server-side client
│   │   └── middleware.ts        # Auth middleware logic
│   ├── hooks/                    # Custom React hooks
│   │   ├── use-auth.ts           # Authentication hook
│   │   ├── use-user-role.ts     # User role detection
│   │   ├── use-invoice.ts        # Invoice operations
│   │   └── use-offline-sync.ts  # Offline sync management
│   ├── utils/                    # Utility functions
│   │   ├── db-mode.ts            # Database mode detection
│   │   ├── store-context.ts      # Store context provider
│   │   ├── invoice-number.ts     # Invoice number generation
│   │   ├── employee-id.ts        # Employee ID generation
│   │   ├── gst-calculator.ts     # GST tax calculations
│   │   ├── pdf-generator.ts      # PDF invoice generation
│   │   ├── excel-import.ts       # Excel file import
│   │   └── excel-export.ts       # Excel file export
│   ├── dexie-client.ts           # Dexie database schema
│   ├── storage-manager.ts        # Unified storage abstraction
│   ├── excel-auto.ts             # Auto-save to Excel
│   └── excel-fs.ts               # Excel File System Access
├── scripts/                      # Database migration scripts
│   ├── 001_initial_schema.sql    # Initial Supabase schema
│   ├── 002_rls_policies.sql      # Row-Level Security policies
│   ├── 003_user_profile_trigger.sql
│   ├── 004_add_employees_table.sql
│   ├── 004_stores_and_employee_auth.sql
│   └── 005_add_employees_and_roles.sql
├── middleware.ts                 # Next.js middleware (auth)
├── package.json
├── next.config.mjs
└── tsconfig.json
```

---

## Application Flow

### End-to-End Lifecycle
1. **License Provisioning** → Run `npm run seed:license -- <LICENSE_KEY> <MAC> "<CLIENT_NAME>"` to allow the device to start.
2. **Admin Signup** → Visit `/auth/signup`, verify email via Supabase, then login at `/auth/login`.
3. **Store Setup** → Navigate to `Settings → Store` and create the default store; the ID is persisted in Dexie + `localStorage.currentStoreId`.
4. **Database Mode Selection** → Stay in IndexedDB (default) or enable Supabase mode via `Settings → Database & Sync`.
5. **Employee Onboarding** → Admin creates employees under `/employees`; IDs/passwords auto-generate. Employees login using Store Code + Employee ID.
6. **Product/Inventory Management** → `/products` and `/inventory` use Dexie in “Local Mode” or Supabase queries in “Supabase Mode” (see badge on page header).
7. **Invoice Creation** → `/invoices/new` loads customers/products from the current datasource, generates invoice numbers, and saves to Dexie/Supabase.
8. **Synchronization** → Header “Sync now” button triggers `syncManager.syncAll()` to push Dexie changes upstream; `SyncStatus` badge reflects record counts.
9. **Reporting & Export** → `/reports/*` aggregates data from the active datasource; PDF/Excel exports are accessible per module.
10. **Distribution** → Deploy web build (`npm run build && npm start`) or ship Electron binaries via `npm run dist:win|mac|linux`.

### Operational Tips
- **Mode Awareness**: Header badge + settings card show “Local/IndexedDB” vs “Supabase”.
- **Logs**: DevTools prints rich context (e.g., `[ProductsPage][Dexie] fetched 33 products`, `[LicenseManager] Online validation successful`).
- **Offline Login**: Enable the toggle before going offline so credentials are cached.

---

## Authentication System

### User Roles

1. **Admin**: Full access, manages stores, employees, and all business data
2. **Employee**: Limited access, can create invoices but not manage employees
3. **Public**: Customer-facing users who can view their own purchases

### Authentication Methods

#### 1. Admin/Public Login (`/auth/login`)
- **Provider**: Supabase Auth
- **Flow**:
  - User enters email/password
  - Supabase validates credentials
  - User profile fetched to determine role
  - Store check: Admin must have a store (redirects to setup if missing)
  - Session stored in cookies via Supabase SSR

#### 2. Employee Login (`/auth/employee-login`)
- **Provider**: Custom authentication (localStorage)
- **Flow**:
  - Employee enters: Store Name, Employee ID (4-char), Password
  - System validates employee exists in store
  - Verifies store belongs to an admin
  - Creates localStorage session
  - Default password = Employee ID (can be changed by admin)

#### 3. Customer Login (`/auth/customer-login`)
- **Provider**: Magic link via email
- **Flow**:
  - Customer enters email
  - System generates magic link token
  - Email sent (TODO: implement API route)
  - Customer clicks link → verified → session created

### Session Management

- **Supabase Sessions**: Managed via cookies, refreshed by middleware
- **Employee Sessions**: Stored in `localStorage.employeeSession`
- **Session Key**: `localStorage.authType` = "employee" | null (Supabase)

### Authorization Flow

```
Request → Middleware → Check Auth → Check Role → Check Store → Route Access
```

**Middleware** (`lib/supabase/middleware.ts`):
- Refreshes Supabase session
- Fetches user role from `user_profiles`
- Redirects unauthenticated users to `/auth/login`
- Enforces role-based route access

---

## Data Layer

### Dual Database Architecture

The application supports two modes:

#### 1. Excel Mode (Default/Offline)
- **Database**: Dexie.js (IndexedDB)
- **Location**: Browser's IndexedDB
- **Sync**: Auto-saves to Excel file via File System Access API
- **Activation**: `localStorage.getItem('databaseType') !== 'supabase'`

**Schema** (`lib/dexie-client.ts`):
```typescript
- products: Product[]
- customers: Customer[]
- invoices: Invoice[]
- invoice_items: InvoiceItem[]
- employees: Employee[]
- stores: Store[]
- settings: StoreSettings
- customer_auth: CustomerAuth[]
- invoice_sequences: InvoiceSequence[]
```

**Operations**:
- All CRUD via `storageManager` (`lib/storage-manager.ts`)
- Auto-export to Excel after every change (500ms debounce)
- Excel sync handled by `excel-auto.ts` and `excel-fs.ts`

#### 2. Supabase Mode (Cloud)
- **Database**: PostgreSQL (Supabase)
- **Location**: Cloud-hosted
- **Sync**: Real-time via Supabase subscriptions
- **Activation**: `localStorage.setItem('databaseType', 'supabase')`

**Schema** (see `scripts/001_initial_schema.sql`):
- Tables: `products`, `customers`, `invoices`, `invoice_items`, `employees`, `stores`, `user_profiles`
- **RLS Enabled**: Row-Level Security restricts data access by user
- **Policies**: Users can only access their own data

**Operations**:
- API routes in `app/api/` for server-side operations
- Client-side via Supabase client (`lib/supabase/client.ts`)
- Server-side via Supabase server client (`lib/supabase/server.ts`)

### Storage Manager Abstraction

`lib/storage-manager.ts` provides a unified interface:

```typescript
// Excel Mode
storageManager.addProduct(product) → Dexie.put() → Auto-export Excel

// Supabase Mode  
storageManager.addProduct(product) → fetch('/api/products', POST)
```

**Note**: Currently, `storageManager` only handles Excel mode. Supabase mode uses API routes directly.

---

## Feature Modules

### 1. Products (`/products`)

**Pages**:
- `app/(dashboard)/products/page.tsx` - Product list with search
- `app/(dashboard)/products/new/page.tsx` - Create product
- `app/(dashboard)/products/[id]/page.tsx` - View/edit product

**Components**:
- `components/features/products/product-form.tsx` - Product form
- `components/features/products/products-table.tsx` - Product table

**Features**:
- CRUD operations
- Excel import/export
- Stock management
- Category organization
- HSN code and GST rate tracking

### 2. Customers (`/customers`)

**Pages**:
- `app/(dashboard)/customers/page.tsx` - Customer list
- `app/(dashboard)/customers/new/page.tsx` - Create customer
- `app/(dashboard)/customers/[id]/page.tsx` - View customer
- `app/(dashboard)/customers/[id]/edit/page.tsx` - Edit customer

**Components**:
- `components/features/customers/customer-form.tsx`
- `components/features/customers/customers-table.tsx`

**Features**:
- Customer database with GSTIN
- Billing/shipping address tracking
- Purchase history (via invoices)

### 3. Invoices (`/invoices`)

**Pages**:
- `app/(dashboard)/invoices/page.tsx` - Invoice list
- `app/(dashboard)/invoices/new/page.tsx` - Create invoice (employees only)
- `app/(dashboard)/invoices/[id]/page.tsx` - View invoice

**Components**:
- `components/features/invoices/invoice-form.tsx` - Complex invoice form
- `components/features/invoices/invoices-table.tsx`
- `components/features/invoices/invoice-actions.tsx` - PDF export, etc.

**Features**:
- GST/Non-GST invoices
- Automatic tax calculations (CGST, SGST, IGST)
- Invoice number generation: `STORE4-EMP4-YYYYMMDDHHmmss-SEQ`
- PDF generation via jsPDF
- Line items with product selection
- Discount support

**Invoice Number Format**:
- `STORE4`: First 4 chars of store code
- `EMP4`: Employee ID (4-char)
- `YYYYMMDDHHmmss`: Timestamp
- `SEQ`: Daily sequence (000-999)

### 4. Employees (`/employees`) - Admin Only

**Pages**:
- `app/(dashboard)/employees/page.tsx` - Employee list
- `app/(dashboard)/employees/new/page.tsx` - Create employee ✨ (Recently added)

**Components**:
- `components/features/employees/employee-form.tsx` ✨ (Recently added)

**Features**:
- Employee management (Admin only)
- Employee ID generation: `STORE_CODE + 01-99` or fallback to name-based
- Default password = Employee ID
- Role assignment (employee/admin)
- Store association
- Excel import support

**Employee ID Generation** (`lib/utils/employee-id.ts`):
1. Try sequential: `STORE_CODE + 01, 02, ... 99`
2. Fallback: First 3 chars of name + digit
3. Last resort: Random 4-char alphanumeric

### 5. Reports (`/reports`)

**Pages**:
- `app/(dashboard)/reports/page.tsx` - Report dashboard
- `app/(dashboard)/reports/sales/page.tsx` - Sales reports
- `app/(dashboard)/reports/tax/page.tsx` - Tax reports
- `app/(dashboard)/reports/inventory/page.tsx` - Inventory reports

**Features**:
- Sales summaries
- GST tax breakdowns
- Inventory status
- Excel export

### 6. Settings (`/settings`)

**Pages**:
- `app/(dashboard)/settings/page.tsx` - Settings overview
- `app/(dashboard)/settings/store/page.tsx` - Store configuration
- `app/(dashboard)/settings/business/page.tsx` - Business details
- `app/(dashboard)/settings/profile/page.tsx` - User profile
- `app/(dashboard)/settings/theme/page.tsx` - Theme preferences

**Features**:
- Store setup (required for admins)
- Store code generation (4-char unique)
- Business information (GSTIN, address)
- Invoice settings (prefix, numbering)
- Database mode switching (Excel ↔ Supabase)

---

## Routing & Navigation

### Route Groups

Next.js App Router uses route groups:

- `(dashboard)`: Dashboard layout with sidebar/header
- `(customer)`: Customer-facing pages (no sidebar)

### Protected Routes

**Middleware Protection** (`middleware.ts`):
- Protected paths: `/dashboard`, `/products`, `/invoices`, `/customers`, `/reports`, `/settings`
- Redirects unauthenticated users to `/auth/login`
- Admin-only: `/admin/*`

**Client-Side Protection**:
- Dashboard layout checks auth and store
- Individual pages check user role (e.g., employees page: admin only)

### Navigation

**Sidebar** (`components/layout/sidebar.tsx`):
- Role-based menu items
- Admin: Analytics, Employees, Reports, Settings
- Employee: Dashboard, Products, Customers, Invoices, Reports
- Online/offline indicator

---

## State Management

### Context Providers

1. **StoreProvider** (`lib/utils/store-context.ts`):
   - Manages current store selection
   - Loads store from Dexie or Supabase
   - Persists to `localStorage.currentStoreId`
   - Required for multi-store operations

2. **ThemeProvider** (`components/theme-provider.tsx`):
   - Dark/light mode
   - Persists to localStorage

### Local Storage Keys

```typescript
'databaseType': 'excel' | 'supabase'
'currentStoreId': string
'authType': 'employee' | null
'employeeSession': JSON string
```

### Custom Hooks

- `useAuth()`: Supabase authentication state
- `useUserRole()`: User role detection (admin/employee/public)
- `useStore()`: Current store context
- `useInvoice()`: Invoice operations
- `useOfflineSync()`: Offline sync status

---

## Known Issues & TODO

### Issues Identified

1. **Supabase Fetch Error** (from terminal):
   - Error: `fetch failed` in Supabase auth
   - **Cause**: Missing or incorrect `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Fix**: Ensure `.env.local` has valid Supabase credentials

2. **Storage Manager Limitation**:
   - `storageManager` only handles Excel mode
   - Supabase mode requires direct API calls
   - **Impact**: Inconsistent data access patterns

3. **Invoice Number Generation**:
   - `generateInvoiceNumber()` only works in Excel mode (uses Dexie)
   - Supabase mode needs equivalent implementation
   - **Location**: `lib/utils/invoice-number.ts`

4. **Employee ID Generation**:
   - Supabase mode has duplicate logic in `employee-form.tsx`
   - Should extract to shared utility like Excel mode
   - **Location**: `components/features/employees/employee-form.tsx` (lines 86-142)

5. **Customer Email Verification**:
   - TODO comment in `app/auth/customer-login/page.tsx` (line 78)
   - Magic link API route not implemented

6. **Password Security**:
   - Employee passwords stored in plaintext
   - **Location**: `employees` table (both Excel and Supabase)
   - **Fix**: Hash passwords using bcrypt or similar

7. **PUT Endpoint Missing**:
   - `app/api/employees/route.ts` PUT method returns 501
   - Employee update via API not fully implemented

### TODO Items

- [ ] Implement customer email verification API route
- [ ] Add password hashing for employees
- [ ] Complete employee PUT endpoint
- [ ] Extract Supabase employee ID generation to utility
- [ ] Add Supabase invoice number generation
- [ ] Standardize storage manager for both modes
- [ ] Add error boundaries for better error handling
- [ ] Implement offline queue for Supabase operations

---

## Setup & Configuration

### Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Setup

#### Supabase Mode:

1. Run migration scripts in order:
   - `scripts/001_initial_schema.sql`
   - `scripts/002_rls_policies.sql`
   - `scripts/003_user_profile_trigger.sql`
   - `scripts/004_stores_and_employee_auth.sql`
   - `scripts/005_add_employees_and_roles.sql`

2. Enable RLS on all tables
3. Configure email templates for magic links

#### Excel Mode:

1. No setup required (works out of the box)
2. First time: Connect Excel file via Settings → Excel Connector
3. Excel structure auto-created if not exists

### Running the Application

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`

## Build & Distribution

### Local Development
```bash
npm install
npm run dev      # Next.js dev server + Electron shell (waits for http://localhost:3000)
```
Set these env vars (if applicable):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_APPLICATION_CREDENTIALS` (for license seeding/tests)

### Production Web Build
```bash
npm run build
npm start
```
> Note: `next.config.mjs` uses `ignoreDuringBuilds: true` for ESLint/TS; resolve warnings before shipping.

### Electron Packaging & Windows .exe Generation
1. **Prepare static Next.js export**  
   ```bash
   npm run build:export
   ```
   - Runs `scripts/prepare-electron-build.js`, builds with `ELECTRON_BUILD=true`, then restores API routes.
2. **Bundle for Windows**  
   ```bash
   npm run dist:win
   ```
   - Invokes `scripts/build-electron-win.js`, clears caches, rebuilds, and runs `electron-builder` with Windows targets (outputs installer/portable dir under `dist/`).
3. **Other platforms**  
   ```bash
   npm run dist:mac
   npm run dist:linux
   npm run dist       # all configured targets
   ```
4. **Post-build checklist**
   - Confirm Dexie/local storage works inside Electron.
   - Ensure any required Firebase credentials or config files are bundled as specified in `package.json→build.files`.
   - Launch the packaged app; verify `LicenseGuard` logs show successful validation.

### License Seeding Script Recap
```bash
node scripts/seed-license.js <licenseKey> <macAddress> <clientName> [expiresInDays]
# or via npm alias
npm run seed:license -- <licenseKey> <macAddress> "<clientName>" 730
```
Steps:
1. Install Firebase Admin dependency if missing (`npm install firebase-admin`).
2. Provide service account JSON via `GOOGLE_APPLICATION_CREDENTIALS` or place it under `app/firebase/`.
3. Run the script; Firestore `licenses` doc is created/updated.
4. Start the app on that machine; `LicenseGuard` caches the license locally and logs status in DevTools.

---

## Data Flow Examples

### Creating an Invoice (Employee)

1. Employee logs in → `localStorage.employeeSession` created
2. Navigate to `/invoices/new`
3. Page checks: `authType === "employee"` → allowed
4. `InvoiceForm` loads:
   - Customers from Dexie/Supabase
   - Products from Dexie/Supabase
   - Store context from `useStore()`
   - Employee ID from session
5. Generate invoice number: `STORE4-EMP4-TIMESTAMP-SEQ`
6. Calculate GST: `gst-calculator.ts`
7. Save via `storageManager.addInvoice()` (Excel) or `fetch('/api/invoices', POST)` (Supabase)
8. Redirect to `/invoices`

### Creating an Employee (Admin)

1. Admin logs in → Supabase session
2. Navigate to `/employees/new`
3. Page checks: `isAdmin === true` → allowed
4. `EmployeeForm` loads:
   - Store from `useStore()`
   - Validates store exists
5. Generate employee ID:
   - Excel: `generateEmployeeId(storeId, name)` → Dexie query
   - Supabase: Inline logic → Supabase query
6. Default password = Employee ID
7. Save:
   - Excel: `storageManager.addEmployee()` → Dexie → Excel export
   - Supabase: `fetch('/api/employees', POST)` → Supabase insert
8. Redirect to `/employees`

---

## Architecture Decisions

1. **Dual-Mode Architecture**: Allows offline-first (Excel) and cloud (Supabase) without code duplication
2. **Feature-Based Components**: Each feature has its own form/table components
3. **Middleware Auth**: Centralized authentication via Next.js middleware
4. **Context for Store**: Store selection managed globally via React Context
5. **LocalStorage Sessions**: Employee sessions use localStorage (lightweight, no server needed)
6. **Auto-Export Excel**: Debounced auto-save ensures data persistence
7. **Invoice Number Format**: Structured format enables tracking and sorting

---

## Summary

This application is a **comprehensive billing solution** with:
- ✅ Dual database support (Excel/Supabase)
- ✅ Multi-user role system
- ✅ Store management
- ✅ GST invoice generation
- ✅ Offline-first capability
- ✅ Employee management (recently completed)
- ⚠️ Some inconsistencies between Excel/Supabase modes
- ⚠️ Password security needs improvement
- ⚠️ Some API endpoints incomplete

The codebase is well-organized with clear separation of concerns. The main areas for improvement are standardizing the dual-mode implementation and completing missing features.
