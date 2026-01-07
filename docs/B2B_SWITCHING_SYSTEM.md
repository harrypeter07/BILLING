# B2B/B2C Switching System Documentation

## Overview

This document describes the controlled B2B/B2C switching system with proper admin → employee propagation. The system ensures that admin decisions control B2B availability, while employees can set their personal billing mode preferences.

## Database Schema

### Migration Required

Run the migration script: `scripts/b2b-switching-migration.sql`

This adds:
- `allow_b2b_mode` (BOOLEAN) to `business_settings` - Admin's master switch
- `employee_b2b_mode` (BOOLEAN) to `user_profiles` - Employee's personal preference

## System Architecture

### 1. Admin Controls (Main Authority)

**Location:** `app/(dashboard)/settings/business/page.tsx`

#### A. "Allow B2B Mode" (Master Switch)
- **Default:** OFF
- **When OFF:**
  - Admin cannot switch to B2B
  - Employees cannot see any B2B/B2C toggle
- **When ON:**
  - Admin can switch between B2B ↔ B2C
  - Employees are allowed to see B2B/B2C toggle

#### B. B2B / B2C Toggle
- **Visible only if** `Allow B2B Mode` = ON
- Controls admin's current billing mode (`is_b2b_enabled`)

### 2. Employee Behavior

**Location:** `app/(dashboard)/settings/employee/page.tsx`

Employees inherit system mode from admin:
- **DB Mode:** Always inherited from admin (read-only, shown in header)
- **B2B/B2C Toggle:**
  - Visible only if admin enabled "Allow B2B Mode"
  - Allows employee to switch their own working view (B2B or B2C)
  - Stored in `user_profiles.employee_b2b_mode`
  - Does NOT affect admin's or other employees' settings

### 3. Employee Settings Page

**Location:** `app/(dashboard)/settings/employee/page.tsx`

#### Allowed:
- ✅ Toggle B2B / B2C (if admin allows)
- ✅ Theme preference (light/dark)

#### Not Allowed:
- ❌ Editing personal information (read-only)
- ❌ Changing DB mode
- ❌ Enabling/disabling B2B globally

### 4. Header Indicators

**Location:** `components/layout/header.tsx`

Shows clearly in both Admin & Employee UI:
- **DB Mode:** `DB: Supabase | IndexedDB` (inherited from admin for employees)
- **Billing Mode:** `Mode: B2B | B2C`

Rules:
- DB mode is always inherited from admin (read-only for employees)
- Billing mode:
  - Admin → controlled by admin toggle (`business_settings.is_b2b_enabled`)
  - Employee → personal toggle (`user_profiles.employee_b2b_mode`, only if admin allows)

### 5. Data Access & Utilities

**Location:** `lib/utils/b2b-mode.ts`

#### Key Functions:

1. **`getB2BModeConfig()`** - Returns complete B2B configuration
   ```typescript
   interface B2BModeConfig {
     allowB2BMode: boolean  // Admin's master switch
     isB2BEnabled: boolean  // Active B2B mode (admin's or employee's)
     isAdmin: boolean       // Whether current user is admin
   }
   ```

2. **`getB2BModeStatus()`** - Legacy function, returns `isB2BEnabled`
   - Used throughout the codebase for B2B checks
   - Automatically respects admin permissions

3. **`canToggleB2B()`** - Check if B2B toggle should be visible

## UI Flow

### Admin Flow:
1. Admin goes to Business Settings
2. Sees "Allow B2B Mode" master switch (requires GSTIN and address)
3. Enables master switch → B2B/B2C toggle appears
4. Toggles between B2B and B2C
5. Header updates to show current mode

### Employee Flow:
1. Employee goes to Employee Settings (visible in sidebar and header menu)
2. If admin has enabled "Allow B2B Mode":
   - Sees B2B/B2C toggle
   - Can switch personal preference
   - Changes don't affect admin or other employees
3. If admin has NOT enabled "Allow B2B Mode":
   - Sees message: "B2B mode is not enabled by your administrator"
   - No toggle visible
4. Header shows:
   - DB mode (inherited from admin, read-only)
   - Personal billing mode (B2B/B2C)

## Integration Points

### Forms & Components

All existing B2B checks automatically respect the new system because they use `getB2BModeStatus()` which internally calls `getB2BModeConfig()`:

- **Customer Form:** `components/features/customers/customer-form.tsx`
- **Product Form:** `app/(dashboard)/products/product-form.tsx`
- **Invoice Form:** `app/(dashboard)/invoices/invoice-form.tsx`
- **Invoice PDF Generation:** `lib/invoice-document-engine.ts`
- **Invoice HTML Generators:** `lib/utils/invoice-html-generator.ts`, `lib/utils/invoice-slip-html-generator.ts`

### Navigation

- **Sidebar:** Employees see "Settings" link → Employee Settings
- **Header Menu:** Context-aware menu items (Business Settings for admin, Employee Settings for employees)

## Safety Rules

✅ **Enforced:**
- No IndexedDB access when in Supabase mode
- Admin decisions always override employee permissions
- Employee changes don't affect admin or other employees
- Master switch validation (GSTIN, address required)

✅ **Database Isolation:**
- Uses existing tables (`business_settings`, `user_profiles`)
- No new tables created
- Minimal schema changes

## Testing Checklist

- [ ] Admin can enable/disable "Allow B2B Mode"
- [ ] Admin can toggle B2B/B2C when "Allow B2B Mode" is ON
- [ ] Employee cannot see B2B toggle when admin has disabled it
- [ ] Employee can toggle personal B2B mode when admin allows
- [ ] Employee's B2B preference doesn't affect admin
- [ ] Header shows correct DB mode (inherited for employees)
- [ ] Header shows correct billing mode (admin's or employee's)
- [ ] All forms respect B2B mode correctly
- [ ] Invoice PDFs reflect correct B2B mode

## Migration Instructions

1. Run `scripts/b2b-switching-migration.sql` in Supabase SQL Editor
2. Verify columns added:
   - `business_settings.allow_b2b_mode`
   - `user_profiles.employee_b2b_mode`
3. Test admin flow: Enable "Allow B2B Mode" → Toggle B2B/B2C
4. Test employee flow: Login as employee → Check Employee Settings

## Notes

- Employee sessions stored in `localStorage` also support `employeeB2BMode` for offline scenarios
- Theme preference is stored in `user_profiles.theme_preference` and applies immediately
- All changes trigger `storage` events to update header indicators in real-time

