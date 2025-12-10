# Vercel License Seeding Setup

## ✅ Yes, You Have a License Seeding Endpoint!

Your app has a **POST** endpoint at `/api/license/seed` that allows you to generate licenses through the web interface.

**Access:** `/admin/license-seed` (requires admin login)

---

## 🔐 Required Environment Variables for Vercel

To make the license seeding endpoint work on Vercel, you need to add **ONE additional environment variable**:

### `FIREBASE_ADMIN_CREDENTIALS`

This is required for the `/api/license/seed` endpoint to write licenses to Firebase Firestore.

---

## 📝 How to Get and Set `FIREBASE_ADMIN_CREDENTIALS`

### Step 1: Get Your Firebase Service Account JSON

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **billingsolution**
3. Go to **Project Settings** (gear icon) → **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file (e.g., `billingsolution-firebase-adminsdk-xxxxx.json`)

### Step 2: Convert to Environment Variable Format

Run this command locally (it will generate the correct format):

```bash
node scripts/prepare-firebase-env.js app/firebase/billingsolution-firebase-adminsdk-*.json
```

This will output **3 options**. For Vercel, use **Option 2 (Base64 Encoded)**:

```
FIREBASE_ADMIN_CREDENTIALS=<base64_string>
```

### Step 3: Add to Vercel

1. Go to **Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**
2. Click **Add New**
3. **Key**: `FIREBASE_ADMIN_CREDENTIALS`
4. **Value**: Paste the base64 string from Step 2
5. **Environment**: ✅ Production ✅ Preview ✅ Development
6. Click **Save**

### Step 4: Redeploy

After adding the variable:
- Go to **Deployments** tab
- Click **Redeploy** on the latest deployment
- Or push a new commit to trigger a new deployment

---

## 📋 Complete Vercel Environment Variables List

For your app to work fully on Vercel, you need these **3 environment variables**:

| Variable Name | Required For | Description |
|--------------|--------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Core App | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Core App | Supabase anonymous key |
| `FIREBASE_ADMIN_CREDENTIALS` | ✅ License Seeding | Firebase Admin SDK credentials (base64) |

---

## 🧪 Testing the License Seeding Endpoint

After deployment:

1. **Login as Admin** at `https://your-app.vercel.app/auth/login`
2. **Navigate to** `/admin/license-seed`
3. **Enter MAC Address**: `E5:8D:22:87:C6:34` (or any device MAC)
4. **Click "Generate License"**
5. **Copy the generated license key**

The endpoint will:
- ✅ Generate a unique license key
- ✅ Save it to Firebase Firestore
- ✅ Return the license details

---

## 🔍 How It Works

1. **User visits** `/admin/license-seed` page
2. **Enters MAC address** and optional client name
3. **Page calls** `POST /api/license/seed` with the data
4. **API endpoint**:
   - Validates admin authentication (Supabase)
   - Generates license key
   - Writes to Firestore using Firebase Admin SDK
   - Returns license details
5. **User copies** the license key to activate on device

---

## ⚠️ Important Notes

- ✅ **You don't need to upload the whole app** - just deploy to Vercel normally
- ✅ The endpoint is **protected** - only admin users can access it
- ✅ Firebase Admin credentials are **server-side only** (never exposed to browser)
- ✅ License validation (reading) uses client-side Firebase SDK (already configured)
- ✅ License seeding (writing) uses server-side Firebase Admin SDK (needs env var)

---

## 🆘 Troubleshooting

### "Failed to initialize Firebase Admin" error

**Fix:**
- Check `FIREBASE_ADMIN_CREDENTIALS` is set in Vercel
- Verify the base64 string is correct (no extra spaces)
- Redeploy after adding the variable

### "Unauthorized" error

**Fix:**
- Make sure you're logged in as an admin user
- Check Supabase authentication is working
- Verify your user has admin role in `user_profiles` table

### "Invalid FIREBASE_ADMIN_CREDENTIALS format" error

**Fix:**
- Regenerate the base64 string using `node scripts/prepare-firebase-env.js`
- Make sure you're using **Option 2 (Base64 Encoded)**
- Don't add quotes around the value in Vercel

---

## 📚 Related Files

- **API Endpoint**: `app/api/license/seed/route.ts`
- **Admin Page**: `app/(dashboard)/admin/license-seed/page.tsx`
- **Firebase Admin Utility**: `lib/utils/firebase-admin.ts`
- **Helper Script**: `scripts/prepare-firebase-env.js`

---

**Last Updated**: 2024

