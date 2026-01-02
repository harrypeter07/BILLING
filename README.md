# Billing Solutions - Smart Billing Application

A comprehensive offline-first Progressive Web App (PWA) for small businesses to manage products, create GST invoices, track customers, generate reports, and share invoices via WhatsApp.

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Application Flow](#application-flow)
- [Security Implementation](#security-implementation)
- [PDF Sharing & WhatsApp Integration](#pdf-sharing--whatsapp-integration)
- [Authentication & Session Management](#authentication--session-management)
- [Database Architecture](#database-architecture)
- [File Structure](#file-structure)
- [Key Features](#key-features)
- [Security Features](#security-features)
- [Development Setup](#development-setup)
- [Environment Variables](#environment-variables)

---

## 🏗️ Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Browser)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   React UI   │  │  IndexedDB   │  │  Service     │     │
│  │  Components  │  │   (Dexie)    │  │  Worker      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Server                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   API Routes │  │  Middleware  │  │   Supabase   │     │
│  │              │  │   (Auth)     │  │   Client     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              External Services                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Supabase   │  │   Firebase   │  │   WhatsApp   │     │
│  │   (Backend)  │  │   (Admin)    │  │   Web API    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Architecture Principles

1. **Offline-First**: All data is stored locally in IndexedDB, enabling full functionality without internet
2. **Progressive Web App**: Installable, works offline, uses service workers
3. **Dual Database Mode**: Supports both IndexedDB (offline) and Supabase (online sync)
4. **Secure Session Management**: Cryptographic signatures prevent session tampering
5. **License-Based Access**: Device-bound licensing system

---

## 🛠️ Technology Stack

### Frontend

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Components**: Radix UI, shadcn/ui
- **State Management**: React Query (TanStack Query)
- **Forms**: React Hook Form + Zod validation

### Backend & Database

- **Primary Database**: IndexedDB (Dexie.js) - Client-side
- **Cloud Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth + Custom offline auth
- **File Storage**: Supabase Storage

### PDF Generation

- **Library**: jsPDF + jsPDF-AutoTable
- **Format**: Mini invoice PDFs for WhatsApp sharing

### Other Libraries

- **Excel**: xlsx (for Excel mode)
- **Cryptography**: crypto-js (HMAC signatures)
- **Charts**: Recharts
- **Date**: date-fns

---

## 🔄 Application Flow

### 1. Application Startup Flow

```
User Opens App
    │
    ▼
┌─────────────────┐
│  LicenseGuard   │ → Check License Validity
└─────────────────┘
    │
    ▼
┌─────────────────┐
│   AuthGuard     │ → Check Session Validity
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Service Worker │ → Register for Offline Support
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Main App UI    │ → Render Dashboard/Login
└─────────────────┘
```

### 2. Authentication Flow

#### Admin/User Login

```
User Enters Credentials
    │
    ▼
┌─────────────────────────┐
│  Supabase Auth (Online) │
│  OR                      │
│  Offline Auth (IndexedDB)│
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Create Secure Session │
│  - Generate HMAC        │
│  - Set Expiry Time      │
│  - Store in IndexedDB   │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Redirect to Dashboard  │
└─────────────────────────┘
```

#### Employee Login

```
Employee Enters Credentials
    │
    ▼
┌─────────────────────────┐
│  Validate Employee ID    │
│  & Password (IndexedDB) │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Create Employee Session│
│  - Store in localStorage│
│  - Link to Store        │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Redirect to Dashboard   │
└─────────────────────────┘
```

### 3. Invoice Creation Flow

```
User Creates Invoice
    │
    ▼
┌─────────────────────────┐
│  Fill Invoice Form      │
│  - Select Customer      │
│  - Add Products/Items   │
│  - Calculate Totals     │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Save to IndexedDB      │
│  - Invoice Header       │
│  - Invoice Items        │
│  - Update Stock         │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Queue for Sync         │
│  (If Supabase Mode)     │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Generate PDF (Optional)│
│  Share on WhatsApp      │
└─────────────────────────┘
```

### 4. PDF Sharing Flow

#### Share PDF Button (Generic Share)

```
User Clicks "Share PDF"
    │
    ▼
┌─────────────────────────┐
│  Fetch Invoice Data     │
│  from IndexedDB         │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Generate PDF Blob      │
│  (jsPDF + AutoTable)    │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Web Share API          │
│  - Create File Object   │
│  - Open Share Dialog    │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  User Selects App       │
│  (Email, WhatsApp, etc.)│
└─────────────────────────┘
```

#### WhatsApp Share Button

```
User Clicks "Share on WhatsApp"
    │
    ▼
┌─────────────────────────┐
│  Check Internet         │
│  Connection             │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Generate WhatsApp      │
│  Message (Formatted)    │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Generate Mini PDF      │
│  (Compact Format)       │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Download PDF           │
│  Open WhatsApp Web      │
│  (wa.me/?text=...)      │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  User Attaches PDF      │
│  Manually in WhatsApp   │
└─────────────────────────┘
```

### 5. Logout Flow

```
User Clicks Logout
    │
    ▼
┌─────────────────────────┐
│  Clear IndexedDB Session│
│  - Delete auth_session  │
│  - Verify Signature     │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Clear localStorage     │
│  - employeeSession      │
│  - offlineAdminSession  │
│  - authType             │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Supabase SignOut       │
│  (If Online)            │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Redirect to Login      │
└─────────────────────────┘
```

---

## 🔒 Security Implementation

### Session Security (Enhanced)

The application implements multiple layers of security to prevent session tampering:

#### 1. Cryptographic Signatures (HMAC-SHA256)

**Implementation**: `lib/utils/auth-session.ts`

- Every session is signed with HMAC-SHA256 using a secret key
- Signature includes: userId, email, role, storeId, issuedAt, expiresAt
- Any modification to session data invalidates the signature
- Signature is verified on every session read

```typescript
// Session Structure
{
  id: "current_session",
  userId: "user-123",
  email: "user@example.com",
  role: "admin",
  storeId: "store-456",
  issuedAt: 1234567890,
  expiresAt: 1234654290,
  signature: "hmac-sha256-hash", // Prevents tampering
  lastValidated: 1234567890,
  validationCount: 1
}
```

#### 2. Server-Side Time Validation

**Implementation**: `app/api/time/route.ts`

- Server provides authoritative timestamp
- Client compares server time vs client time
- Detects time manipulation (>5 minute difference)
- Falls back to client time if server unavailable (offline mode)

#### 3. Multiple Validation Layers

- **Signature Validation**: Detects data tampering
- **Time Validation**: Detects clock manipulation
- **Expiry Check**: Uses server time when available
- **Anomaly Detection**: Tracks validation count for suspicious patterns

#### 4. Security Features

✅ **Prevents**:

- Modifying `expiresAt` timestamp in IndexedDB
- Changing system time to extend sessions
- Tampering with session data (userId, email, role)
- Replay attacks (signature changes on each validation)

✅ **Detects**:

- Invalid signatures → Auto-logout
- Time manipulation → Warning logged
- Suspicious validation patterns → Alert

#### 5. Vulnerabilities Fixed

| Vulnerability       | Previous State      | Fixed State                   |
| ------------------- | ------------------- | ----------------------------- |
| IndexedDB Tampering | ❌ No protection    | ✅ HMAC signatures            |
| Time Manipulation   | ❌ Client time only | ✅ Server time validation     |
| Session Replay      | ❌ No detection     | ✅ Signature validation       |
| Data Integrity      | ❌ No checks        | ✅ Cryptographic verification |

---

## 📄 PDF Sharing & WhatsApp Integration

### PDF Generation

#### Files Involved:

- `lib/utils/mini-invoice-pdf.ts` - Mini invoice PDF (WhatsApp format)
- `lib/utils/pdf-generator.ts` - Full invoice PDF
- `lib/utils/pdf-invoice-generator.ts` - Alternative PDF generator

#### PDF Generation Flow:

1. **Data Collection**:

   - Invoice header (number, date, customer)
   - Invoice items (description, quantity, price, GST)
   - Totals (subtotal, CGST, SGST, IGST, total)
   - Business information (name, GSTIN, address)

2. **PDF Creation**:

   - Uses jsPDF library
   - AutoTable plugin for item tables
   - Custom styling (colors, fonts, layout)
   - Mini format: 80mm x 210mm (receipt-like)
   - Full format: A4 size

3. **Output**:
   - Returns Blob object
   - Can be downloaded or shared

### Share PDF Button

**Location**: `app/(dashboard)/invoices/[id]/page-client.tsx`

**Flow**:

1. Fetches invoice data from IndexedDB (no Supabase dependency)
2. Generates PDF using `generateMiniInvoicePDF()`
3. Creates File object from PDF Blob
4. Uses Web Share API (`navigator.share()`)
5. User selects sharing app (Email, WhatsApp, etc.)

**Features**:

- ✅ Works offline (uses IndexedDB only)
- ✅ No Supabase dependency
- ✅ Generic share (works with any app)
- ✅ Fallback to download if share not supported

### WhatsApp Share Button

**Location**: `components/features/invoices/whatsapp-share-button.tsx`

**Flow**:

1. Checks internet connection (required)
2. Generates formatted WhatsApp message
3. Generates mini invoice PDF
4. Downloads PDF automatically
5. Opens WhatsApp Web (`https://wa.me/?text=...`)
6. User manually attaches downloaded PDF

**Message Format**:

```
📋 *Invoice Receipt*

🏪 *Store Name*

━━━━━━━━━━━━━━━━━━━━
📄 Invoice #INV-001
📅 Date: 01/01/2024
━━━━━━━━━━━━━━━━━━━━

*Items:*
1. Product Name
   Qty: 2 × ₹100.00 = ₹200.00

━━━━━━━━━━━━━━━━━━━━
💰 *Total: ₹200.00*
━━━━━━━━━━━━━━━━━━━━

📱 View full invoice:
https://app.com/i/invoice-id

Thank you for your business! 🙏
```

**Features**:

- ✅ Formatted message with emojis
- ✅ Auto-downloads PDF
- ✅ Opens WhatsApp Web directly
- ✅ Includes invoice link

### Save & Share on WhatsApp (Invoice Form)

**Location**: `components/features/invoices/invoice-form.tsx`

**Flow**:

1. User fills invoice form
2. Clicks "Save & Share on WhatsApp"
3. Saves invoice to IndexedDB
4. Generates PDF
5. Opens WhatsApp with message
6. Downloads PDF for attachment

---

## 🔐 Authentication & Session Management

### Session Storage

#### IndexedDB (Primary)

- **Table**: `auth_session`
- **Structure**: See `lib/db/dexie.ts` - `AuthSession` interface
- **Security**: HMAC signatures prevent tampering

#### localStorage (Secondary)

- `employeeSession` - Employee login data
- `offlineAdminSession` - Offline admin session
- `authType` - "employee" or "admin"
- `currentStoreId` - Selected store ID

### Session Validation

**Component**: `components/auth-guard.tsx`

**Checks**:

1. IndexedDB session exists and valid
2. Signature verification
3. Expiry check (server time)
4. Employee session (if applicable)
5. Offline admin session (if applicable)

**Frequency**: Every 5 seconds (periodic check)

### Session Expiry

- **Default Duration**: 24 hours (86400000 ms)
- **Configurable**: `NEXT_PUBLIC_SESSION_DURATION_MS` env variable
- **Validation**: Server time when available, client time as fallback
- **Auto-logout**: On expiry, redirects to `/auth/session-expired`

### Logout Implementation

**Files**:

- `app/auth/login/page.tsx` - Login page logout
- `components/layout/sidebar.tsx` - Sidebar logout button
- `components/layout/header.tsx` - Header logout menu

**Process**:

1. Clear IndexedDB session (`clearAuthSession()`)
2. Clear localStorage (employeeSession, offlineAdminSession, etc.)
3. Supabase signOut (if online)
4. Redirect to login

---

## 💾 Database Architecture

### IndexedDB (Dexie)

**Database Name**: `BillingDatabase`

**Tables**:

- `products` - Product catalog
- `customers` - Customer information
- `invoices` - Invoice headers
- `invoice_items` - Invoice line items
- `employees` - Employee data
- `stores` - Store information
- `settings` - Application settings
- `auth_session` - Authentication sessions
- `sync_queue` - Sync queue for Supabase
- `license` - License information
- `inventory` - Inventory tracking
- `attendance` - Employee attendance
- `sales_header` - Sales transactions
- `sales_items` - Sales line items

**Schema Version**: 4 (with auth_session support)

### Supabase (PostgreSQL)

**Tables**: See `types/database.types.ts`

**Sync Strategy**:

- Offline-first: All writes go to IndexedDB first
- Background sync: Sync queue processes changes
- Conflict resolution: Last-write-wins
- Sync frequency: Every 30 seconds (when online)

---

## 📁 File Structure

```
billing-solutions/
├── app/                          # Next.js App Router
│   ├── (dashboard)/             # Dashboard routes (protected)
│   │   ├── invoices/            # Invoice management
│   │   │   ├── [id]/           # Invoice detail page
│   │   │   │   └── page-client.tsx  # Share PDF button
│   │   │   └── new/             # Create invoice
│   │   ├── products/            # Product management
│   │   ├── customers/           # Customer management
│   │   └── ...
│   ├── auth/                    # Authentication routes
│   │   ├── login/               # Login page
│   │   ├── employee-login/     # Employee login
│   │   └── session-expired/     # Session expired page
│   ├── api/                     # API routes
│   │   ├── time/                # Server time endpoint
│   │   └── invoices/            # Invoice API
│   └── layout.tsx               # Root layout
├── components/
│   ├── auth-guard.tsx           # Authentication guard
│   ├── license-guard.tsx        # License validation
│   ├── features/
│   │   └── invoices/
│   │       ├── invoice-form.tsx        # Invoice creation form
│   │       ├── invoice-actions.tsx      # Invoice actions menu
│   │       └── whatsapp-share-button.tsx  # WhatsApp share
│   └── layout/
│       ├── header.tsx           # App header
│       └── sidebar.tsx          # Sidebar navigation
├── lib/
│   ├── db/
│   │   └── dexie.ts            # IndexedDB schema
│   ├── utils/
│   │   ├── auth-session.ts     # Secure session management
│   │   ├── mini-invoice-pdf.ts # PDF generation
│   │   ├── whatsapp-bill.ts    # WhatsApp integration
│   │   └── invoice-pdf-sync.ts # PDF sync utilities
│   ├── supabase/               # Supabase clients
│   └── hooks/                  # Custom React hooks
└── public/                      # Static assets
    ├── manifest.json           # PWA manifest
    └── sw.js                   # Service worker
```

---

## ✨ Key Features

### 1. Invoice Management

- Create GST/non-GST invoices
- Multiple tax calculations (CGST, SGST, IGST)
- Discount support
- Print/Download PDF
- Share via WhatsApp

### 2. Product Management

- Product catalog with categories
- Stock tracking
- HSN code support
- GST rates per product

### 3. Customer Management

- Customer database
- GSTIN tracking
- Contact information
- Purchase history

### 4. Employee Management

- Employee login system
- Store-based access
- Attendance tracking
- Role-based permissions

### 5. Reports & Analytics

- Sales reports
- Inventory reports
- Tax reports
- Dashboard analytics

### 6. Offline Support

- Full offline functionality
- Background sync
- Service worker caching
- IndexedDB storage

---

## 🛡️ Security Features

### Implemented Security Measures

1. **Session Security**

   - ✅ HMAC-SHA256 signatures
   - ✅ Server time validation
   - ✅ Signature verification on every read
   - ✅ Auto-logout on tampering detection

2. **License Protection**

   - ✅ Device-bound licensing
   - ✅ MAC address binding
   - ✅ Expiry validation
   - ✅ Revocation support

3. **Data Integrity**

   - ✅ Cryptographic signatures
   - ✅ Validation on read/write
   - ✅ Anomaly detection

4. **Authentication**
   - ✅ Secure password hashing
   - ✅ Session expiry enforcement
   - ✅ Multi-factor validation

### Security Best Practices

- ✅ Never trust client-side data alone
- ✅ Always verify signatures
- ✅ Use server time when available
- ✅ Log security events
- ✅ Auto-logout on suspicious activity

---

## 🚀 Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (optional, for cloud sync)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd billing-solutions

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run development server
npm run dev
```

### Environment Variables

```env
# Supabase (Optional)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Session Configuration
NEXT_PUBLIC_SESSION_DURATION_MS=86400000  # 24 hours
NEXT_PUBLIC_SESSION_SECRET=your-secret-key  # Change in production!

# Other
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Build

```bash
# Production build
npm run build

# Start production server
npm start
```

---

## 📝 Environment Variables

### Required

- `NEXT_PUBLIC_SESSION_SECRET` - Secret key for HMAC signatures (MUST be changed in production)

### Optional

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_SESSION_DURATION_MS` - Session duration in milliseconds (default: 86400000)
- `NEXT_PUBLIC_APP_URL` - Application URL

---

## 🔧 Configuration

### Session Duration

Edit `NEXT_PUBLIC_SESSION_DURATION_MS` in `.env.local`:

```env
# 1 hour
NEXT_PUBLIC_SESSION_DURATION_MS=3600000

# 12 hours
NEXT_PUBLIC_SESSION_DURATION_MS=43200000

# 24 hours (default)
NEXT_PUBLIC_SESSION_DURATION_MS=86400000
```

### Database Mode

The app supports two modes:

- **IndexedDB Mode**: Fully offline, no Supabase
- **Supabase Mode**: Online sync with Supabase

Mode is determined automatically based on Supabase configuration.

---

## 📚 Additional Documentation

- [Security Implementation Details](./docs/SECURITY.md)
- [API Documentation](./docs/API.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📄 License

Proprietary - All rights reserved

---

## 🆘 Support

For issues or questions:

- Create an issue in the repository
- Contact the development team

---

**Last Updated**: 2024
**Version**: 0.1.0
