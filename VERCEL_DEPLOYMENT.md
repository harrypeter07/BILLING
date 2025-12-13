# Complete Vercel Deployment Guide

This guide covers everything you need to deploy your Billing Solutions app to Vercel as a website while keeping Electron builds unaffected.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables Setup](#environment-variables-setup)
3. [Supabase Configuration](#supabase-configuration)
4. [Firebase Configuration](#firebase-configuration)
5. [Vercel Deployment Steps](#vercel-deployment-steps)
6. [Post-Deployment Checklist](#post-deployment-checklist)
7. [Troubleshooting](#troubleshooting)

---

## ✅ Prerequisites

Before deploying, ensure you have:

- ✅ A Vercel account (sign up at [vercel.com](https://vercel.com))
- ✅ A Supabase project (sign up at [supabase.com](https://supabase.com))
- ✅ Firebase project (already configured in your code)
- ✅ Git repository (GitHub, GitLab, or Bitbucket)
- ✅ Node.js 18+ installed locally (for testing)

---

## 🔐 Environment Variables Setup

### Required Environment Variables

You need to set these in **Vercel Dashboard** → **Project Settings** → **Environment Variables**:

| Variable Name | Description | Where to Get It | Required |
|--------------|-------------|-----------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Supabase Dashboard → Settings → API | ✅ Yes |
| `NEXT_PUBLIC_APP_URL` | Your Vercel app URL (for email links) | Your Vercel domain (e.g., `https://billing-tawny.vercel.app`) | ✅ **Yes** (for email verification) |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | Redirect URL after signup (optional) | Your Vercel domain (auto-set) | ⚠️ Optional |

### How to Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add each variable:
   - **Key**: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: `https://your-project.supabase.co` (from Supabase)
   - **Environment**: Select `Production`, `Preview`, and `Development`
   - Click **Save**
4. Repeat for `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Important**: Make sure to add them to **all environments** (Production, Preview, Development) so they work everywhere.

---

## 🗄️ Supabase Configuration

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Fill in:
   - **Name**: `billing-solutions` (or your choice)
   - **Database Password**: (save this securely)
   - **Region**: Choose closest to your users
4. Wait for project to be created (~2 minutes)

### Step 2: Get Supabase Credentials

1. In Supabase Dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co` → This is `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` → This is `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Step 3: Run Database Migrations

Your app needs these database tables. Run these SQL scripts in Supabase SQL Editor:

1. Go to **SQL Editor** in Supabase Dashboard
2. Run each script in order:

```sql
-- Script 1: Initial Schema
-- File: scripts/001_initial_schema.sql
-- (Copy contents from your scripts/001_initial_schema.sql)

-- Script 2: RLS Policies
-- File: scripts/002_rls_policies.sql

-- Script 3: User Profile Trigger
-- File: scripts/003_user_profile_trigger.sql

-- Script 4: Stores and Employee Auth
-- File: scripts/004_stores_and_employee_auth.sql

-- Script 5: Employees and Roles
-- File: scripts/005_add_employees_and_roles.sql
```

**Quick Check**: After running migrations, verify tables exist:
- Go to **Table Editor** → You should see: `products`, `customers`, `invoices`, `invoice_items`, `employees`, `stores`, `user_profiles`

### Step 4: Configure Supabase Auth

1. Go to **Authentication** → **URL Configuration**
2. Add your Vercel domain to **Site URL**: `https://your-app.vercel.app`
3. Add redirect URLs:
   - `https://your-app.vercel.app/dashboard`
   - `https://your-app.vercel.app/auth/customer-verify`
   - `https://your-app.vercel.app/**` (for all routes)

### Step 5: Enable Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. Customize signup/login emails if needed
3. Ensure email provider is configured (Supabase provides free tier)

---

## 🔥 Firebase Configuration

Your app uses Firebase Firestore for license management. The config is already in `lib/firebase.js`.

### Step 1: Verify Firebase Project

Your Firebase project is already configured:
- **Project ID**: `billingsolution`
- **API Key**: Already in code (safe to expose publicly)
- **Auth Domain**: `billingsolution.firebaseapp.com`

### Step 2: Configure Firestore Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: **billingsolution**
3. Go to **Firestore Database** → **Rules**
4. Add these rules (for license collection):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Licenses collection - read-only for authenticated users
    match /licenses/{licenseId} {
      allow read: if request.auth != null;
      allow write: if false; // Only server-side writes via Admin SDK
    }
  }
}
```

**Note**: For web deployment, you may want to allow public read access to licenses (since license validation happens client-side). Adjust based on your security needs.

### Step 3: Add Vercel Domain to Firebase (Optional)

If you want Firebase Analytics:
1. Go to **Project Settings** → **General**
2. Add your Vercel domain to authorized domains

---

## 🚀 Vercel Deployment Steps

### Method 1: Deploy via Vercel Dashboard (Recommended)

1. **Push Code to Git**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Import Project in Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Click **Import Git Repository**
   - Select your repository (GitHub/GitLab/Bitbucket)
   - Click **Import**

3. **Configure Project**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run vercel-build` (already set in vercel.json)
   - **Output Directory**: `.next` (already set in vercel.json)
   - **Install Command**: `npm install` (already set in vercel.json)

4. **Add Environment Variables**
   - Click **Environment Variables**
   - Add:
     - `NEXT_PUBLIC_SUPABASE_URL` = `https://your-project.supabase.co`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your-anon-key`
   - Select all environments (Production, Preview, Development)
   - Click **Save**

5. **Deploy**
   - Click **Deploy**
   - Wait for build to complete (~2-5 minutes)
   - Your app will be live at `https://your-project.vercel.app`

### Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```
   - Follow prompts:
     - Link to existing project? **No** (first time)
     - Project name: `billing-solutions` (or your choice)
     - Directory: `./`
     - Override settings? **No**

4. **Set Environment Variables**
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   # Paste your Supabase URL when prompted
   # Select: Production, Preview, Development
   
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   # Paste your Supabase anon key when prompted
   # Select: Production, Preview, Development
   ```

5. **Deploy to Production**
   ```bash
   vercel --prod
   ```

---

## ✅ Post-Deployment Checklist

After deployment, verify these:

### 1. Test Basic Functionality
- [ ] Visit your Vercel URL: `https://your-app.vercel.app`
- [ ] Check if homepage loads
- [ ] Verify no console errors (open DevTools)

### 2. Test Authentication
- [ ] Go to `/auth/signup`
- [ ] Create a test admin account
- [ ] Verify email (check Supabase Auth logs)
- [ ] Login at `/auth/login`
- [ ] Should redirect to `/dashboard`

### 3. Test Database Connection
- [ ] After login, go to `/products`
- [ ] Try creating a product
- [ ] Check Supabase Table Editor → `products` table
- [ ] Verify data appears

### 4. Test License System
- [ ] Go to `/license` page
- [ ] Enter a license key (if you have one)
- [ ] Verify license validation works
- [ ] Check Firebase Firestore → `licenses` collection

### 5. Test Employee Login
- [ ] Create an employee via `/employees` (as admin)
- [ ] Logout
- [ ] Go to `/auth/employee-login`
- [ ] Login with employee credentials
- [ ] Should access dashboard

### 6. Test Offline Mode (PWA)
- [ ] Open app in browser
- [ ] Go to browser settings → Install app
- [ ] Test offline functionality (IndexedDB should work)

### 7. Verify Environment Variables
- [ ] Check Vercel Dashboard → Settings → Environment Variables
- [ ] Ensure all variables are set for Production
- [ ] Check build logs for any missing env warnings

---

## 🔧 Troubleshooting

### Build Fails

**Error**: `NEXT_PUBLIC_SUPABASE_URL is not defined`
- **Fix**: Add environment variables in Vercel Dashboard → Settings → Environment Variables

**Error**: `Module not found: Can't resolve 'electron'`
- **Fix**: This shouldn't happen, but if it does, check `next.config.mjs` - Electron code should be excluded in web builds

**Error**: `Build timeout`
- **Fix**: Increase build timeout in Vercel Dashboard → Settings → General → Build & Development Settings

### App Deploys but Shows Errors

**Error**: `Failed to fetch` or `Network error`
- **Fix**: Check Supabase URL and anon key are correct
- **Fix**: Verify Supabase project is active and not paused

**Error**: `License validation failed`
- **Fix**: Check Firebase Firestore rules allow read access
- **Fix**: Verify Firebase config in `lib/firebase.js` is correct

**Error**: `Authentication failed`
- **Fix**: Check Supabase Auth → URL Configuration has your Vercel domain
- **Fix**: Verify redirect URLs are set correctly

### Database Issues

**Error**: `Table does not exist`
- **Fix**: Run all migration scripts in Supabase SQL Editor
- **Fix**: Check table names match exactly (case-sensitive)

**Error**: `RLS policy violation`
- **Fix**: Check Row-Level Security policies in Supabase
- **Fix**: Verify user has correct role in `user_profiles` table

---

## 📝 Important Notes

### Electron Builds Still Work

✅ Your Electron builds are **completely unaffected**:
- `npm run dist:win` still works locally
- `npm run dist:mac` still works locally
- `npm run dist:linux` still works locally
- Electron-specific code is excluded from web builds via `next.config.mjs`

### Environment Variables

- **Public variables** (`NEXT_PUBLIC_*`) are exposed to the browser
- **Never commit** `.env.local` to Git (already in `.gitignore`)
- **Always set** environment variables in Vercel Dashboard, not in code

### Firebase Service Account

⚠️ **Important**: The Firebase Admin SDK service account JSON (`app/firebase/billingsolution-firebase-adminsdk-*.json`) is **NOT** needed for web deployment. It's only used for server-side license seeding scripts.

For web deployment, license validation uses the client-side Firebase SDK (already configured in `lib/firebase.js`).

### Custom Domain (Optional)

To use a custom domain:
1. Go to Vercel Dashboard → Settings → Domains
2. Add your domain: `billing.yourdomain.com`
3. Follow DNS configuration instructions
4. Update Supabase Auth → URL Configuration with new domain

---

## 🎉 You're Done!

Your app is now deployed to Vercel and accessible as a website. Users can:
- Access it via browser (no installation needed)
- Use it as a PWA (installable)
- Work offline (IndexedDB mode)
- Sync with Supabase (cloud mode)

**Your Electron builds continue to work independently** - you can still create `.exe` files locally using `npm run dist:win`.

---

## 📞 Support

If you encounter issues:
1. Check Vercel build logs: Dashboard → Deployments → Click deployment → View logs
2. Check Supabase logs: Dashboard → Logs
3. Check browser console: Open DevTools → Console tab
4. Review this guide's troubleshooting section

---

**Last Updated**: 2024
**App Version**: 0.1.0

