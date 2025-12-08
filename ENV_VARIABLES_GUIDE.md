# Environment Variables Guide

## 📋 What to Set in Vercel

Go to: **Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**

Add these **2 variables**:

---

### 1. NEXT_PUBLIC_SUPABASE_URL

**How to get it:**
1. Go to [supabase.com](https://supabase.com) → Your Project
2. Click **Settings** (gear icon) → **API**
3. Under **Project URL**, copy the URL
4. It looks like: `https://abcdefghijklmnop.supabase.co`

**Set in Vercel:**
- **Key**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://abcdefghijklmnop.supabase.co` (your actual URL)
- **Environment**: ✅ Production ✅ Preview ✅ Development
- Click **Save**

---

### 2. NEXT_PUBLIC_SUPABASE_ANON_KEY

**How to get it:**
1. Same page: **Settings** → **API**
2. Under **Project API keys**, find **anon/public** key
3. Copy the long string (starts with `eyJhbGci...`)

**Set in Vercel:**
- **Key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODk2NzI5MCwiZXhwIjoxOTU0NTQzMjkwfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (your actual key)
- **Environment**: ✅ Production ✅ Preview ✅ Development
- Click **Save**

---

## ✅ Verification

After setting both variables:

1. **Check they're saved:**
   - Go back to Environment Variables page
   - You should see both variables listed

2. **Redeploy:**
   - Go to **Deployments** tab
   - Click **Redeploy** on latest deployment
   - Or push a new commit to trigger deployment

3. **Test:**
   - Visit your deployed app
   - Open browser DevTools → Console
   - Should see no errors about missing env variables

---

## 🔍 How to Find Your Supabase Credentials

### Step-by-Step Screenshots Guide:

1. **Login to Supabase**
   - Go to [app.supabase.com](https://app.supabase.com)
   - Login with your account

2. **Select Your Project**
   - Click on your project name (or create new one)

3. **Go to Settings**
   - Click the **gear icon** (⚙️) in left sidebar
   - Click **API**

4. **Copy Values**
   - **Project URL**: Copy the URL under "Project URL" section
   - **anon key**: Copy the key under "Project API keys" → "anon public"

---

## ⚠️ Important Notes

- ✅ These are **public** keys (safe to expose in browser)
- ✅ Must start with `NEXT_PUBLIC_` to be accessible in browser
- ✅ Set for **all environments** (Production, Preview, Development)
- ❌ **Never commit** these values to Git (already in `.gitignore`)
- ❌ **Don't share** your anon key publicly (though it's designed to be public)

---

## 🆘 Troubleshooting

**"Environment variable not found" error:**
- Check variable name is exactly: `NEXT_PUBLIC_SUPABASE_URL` (case-sensitive)
- Check you selected all environments (Production, Preview, Development)
- Redeploy after adding variables

**"Invalid Supabase URL" error:**
- Check URL starts with `https://`
- Check URL ends with `.supabase.co`
- No trailing slash

**"Invalid API key" error:**
- Check you copied the **anon/public** key, not the **service_role** key
- Check key is complete (very long string)
- No extra spaces when copying

---

## 📝 Example Values (Don't Use These!)

These are examples - use YOUR actual values from Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODk2NzI5MCwiZXhwIjoxOTU0NTQzMjkwfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

**Next Step:** After setting these, follow `VERCEL_DEPLOYMENT.md` for full deployment guide.

