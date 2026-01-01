# PWA Offline Implementation Guide

## Overview

This document describes the offline-first PWA implementation that allows the billing app to work fully offline after initial login, with configurable session expiry.

## Key Features

1. **Service Worker** - Caches app shell and routes for offline access
2. **IndexedDB Auth Session** - Stores authentication session locally with expiry
3. **Auth Guard** - Validates session on app startup (works offline)
4. **Configurable Session Duration** - Set via `NEXT_PUBLIC_SESSION_DURATION_MS` env variable
5. **Offline Fallback** - Shows offline.html when network fails
6. **Client-Side Routing Only** - All navigation uses Next.js router

## Implementation Details

### 1. Service Worker (`public/sw.js`)

**Caching Strategy:**
- **App Shell**: CacheFirst for critical routes (/, /dashboard, /invoices, etc.)
- **Static Assets**: CacheFirst for JS, CSS, images
- **API Calls**: NetworkFirst (try network, fallback to cache)
- **HTML Pages**: NetworkFirst with offline.html fallback

**Routes Cached:**
- `/`, `/dashboard`, `/invoices`, `/invoices/new`
- `/products`, `/products/new`
- `/customers`, `/customers/new`
- `/employees`, `/auth/login`
- `/offline.html`

### 2. IndexedDB Auth Session (`lib/utils/auth-session.ts`)

**Session Structure:**
```typescript
{
  id: "current_session",
  userId: string,
  email: string,
  role: string,
  storeId?: string | null,
  issuedAt: number, // timestamp
  expiresAt: number, // timestamp
  createdAt: string
}
```

**Functions:**
- `saveAuthSession()` - Save session after login
- `getAuthSession()` - Get current session (checks expiry)
- `isSessionValid()` - Check if session is valid
- `clearAuthSession()` - Clear session on logout
- `getSessionDuration()` - Get configured session duration

### 3. Auth Guard (`components/auth-guard.tsx`)

**Behavior:**
- Runs on every route change
- Checks IndexedDB session (works offline)
- Redirects to `/auth/login` if session expired or missing
- Allows public routes: `/auth/login`, `/auth/signup`, `/license`, `/`

**Public Routes:**
- `/auth/login`
- `/auth/signup`
- `/auth/employee-login`
- `/auth/customer-login`
- `/license`
- `/`

### 4. Session Duration Configuration

**Environment Variable:**
```bash
NEXT_PUBLIC_SESSION_DURATION_MS=86400000  # 24 hours (production)
NEXT_PUBLIC_SESSION_DURATION_MS=60000    # 1 minute (testing)
NEXT_PUBLIC_SESSION_DURATION_MS=10000    # 10 seconds (quick testing)
```

**Default:** 86400000 (24 hours) if not set

### 5. Login Flow

**Admin/Public Login (`app/auth/login/page.tsx`):**
1. User logs in via Supabase (requires internet)
2. On success:
   - Save session to IndexedDB with expiry
   - Save to localStorage (for backward compatibility)
   - Redirect to dashboard

**Employee Login (`app/auth/employee-login/page.tsx`):**
1. Employee logs in with Employee ID + Password
2. On success:
   - Save session to IndexedDB with expiry
   - Save to localStorage
   - Redirect to invoice creation

### 6. Logout Flow

**All logout handlers:**
1. Clear Supabase session (if online)
2. Clear IndexedDB session
3. Clear localStorage session
4. Redirect to `/auth/login`

### 7. Offline Fallback (`public/offline.html`)

- Shows when network request fails
- Provides link to dashboard
- Checks connection status
- Auto-redirects when connection restored

### 8. Service Worker Registration (`components/service-worker-register.tsx`)

- Registers on app load
- Handles updates gracefully
- Skips registration in Electron environment

## Usage

### Testing Session Expiry

1. Set short duration in `.env.local`:
   ```bash
   NEXT_PUBLIC_SESSION_DURATION_MS=10000  # 10 seconds
   ```

2. Login to the app
3. Wait 10 seconds
4. Navigate to any route
5. Should redirect to login (session expired)

### Testing Offline Mode

1. Login to the app (requires internet)
2. Open DevTools → Network → Check "Offline"
3. Navigate to `/dashboard`, `/invoices`, `/products`
4. All routes should work offline
5. Create/edit invoices/products - saved to IndexedDB
6. When back online, data syncs automatically

### PWA Install

**Desktop (Chrome/Edge):**
- Look for install icon in address bar
- Click "Install" → Install Billing Solutions"

**Mobile (iOS Safari):**
- Tap Share button → "Add to Home Screen"

**Mobile (Android Chrome):**
- Tap menu → "Install app" or "Add to Home screen"

## File Structure

```
public/
  sw.js                    # Service Worker
  offline.html            # Offline fallback page
  manifest.json           # PWA manifest

lib/
  utils/
    auth-session.ts       # IndexedDB session management
  db/
    dexie.ts             # Database schema (includes auth_session table)

components/
  auth-guard.tsx          # Session validation guard
  service-worker-register.tsx  # SW registration

app/
  layout.tsx             # Root layout (includes AuthGuard, SW register)
  auth/
    login/page.tsx       # Login (saves to IndexedDB)
    employee-login/page.tsx  # Employee login (saves to IndexedDB)
```

## Important Notes

1. **Login Requires Internet**: Initial login must be online (Supabase auth)
2. **Session Works Offline**: After login, session is stored in IndexedDB
3. **Auto-Logout on Expiry**: AuthGuard checks expiry on every route
4. **No Hard Reloads**: All navigation uses Next.js router
5. **Data Sync**: Unsaved data marked with `is_synced: false`, syncs when online

## Troubleshooting

**Service Worker not registering:**
- Check browser console for errors
- Ensure HTTPS (or localhost for development)
- Clear browser cache and reload

**Session expires immediately:**
- Check `NEXT_PUBLIC_SESSION_DURATION_MS` value
- Verify IndexedDB is accessible (check DevTools → Application → IndexedDB)

**Routes not working offline:**
- Check service worker is active (DevTools → Application → Service Workers)
- Verify routes are in APP_SHELL array in `sw.js`
- Clear cache and re-register service worker

**Auth guard blocking access:**
- Check IndexedDB for `auth_session` table
- Verify session `expiresAt` is in future
- Check browser console for auth guard logs

