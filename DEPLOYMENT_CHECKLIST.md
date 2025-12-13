# Quick Deployment Checklist

Use this checklist when deploying to Vercel.

## ✅ Pre-Deployment

- [ ] Code pushed to Git repository
- [ ] Supabase project created
- [ ] Supabase database migrations run (5 SQL scripts)
- [ ] Firebase project verified (already configured)

## 🔐 Environment Variables (Set in Vercel)

- [ ] `NEXT_PUBLIC_SUPABASE_URL` = `https://xxxxx.supabase.co`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGci...`
- [ ] `NEXT_PUBLIC_APP_URL` = `https://billing-tawny.vercel.app` (or your Vercel domain)
- [ ] All set for: Production ✅ Preview ✅ Development ✅

## 🚀 Deploy Steps

1. [ ] Go to [vercel.com/new](https://vercel.com/new)
2. [ ] Import Git repository
3. [ ] Framework: Next.js (auto-detected)
4. [ ] Add environment variables (see above)
5. [ ] Click Deploy
6. [ ] Wait for build (~2-5 min)

## ✅ Post-Deployment Tests

- [ ] Homepage loads: `https://your-app.vercel.app`
- [ ] Signup works: `/auth/signup`
- [ ] Login works: `/auth/login`
- [ ] Dashboard accessible: `/dashboard`
- [ ] Create product: `/products` → Add product → Check Supabase
- [ ] License page works: `/license`
- [ ] No console errors (check DevTools)

## 📝 Supabase Configuration

- [ ] Auth → URL Configuration: Added Vercel domain
- [ ] Auth → Redirect URLs: Added `/dashboard` and `/auth/customer-verify`
- [ ] Tables exist: `products`, `customers`, `invoices`, `employees`, `stores`, `user_profiles`

## 🔥 Firebase Configuration

- [ ] Firestore rules allow read access to `licenses` collection
- [ ] Firebase config in `lib/firebase.js` is correct (already done)

## ⚠️ Important Notes

- ✅ Electron builds (`npm run dist:win`) still work locally - unaffected
- ✅ Environment variables must be set in Vercel Dashboard, not in code
- ✅ Firebase Admin SDK JSON is NOT needed for web deployment

---

**Quick Commands:**

```bash
# Test build locally
npm run build
npm run web:start

# Deploy via CLI (optional)
vercel
vercel --prod
```

---

**Need Help?** See `VERCEL_DEPLOYMENT.md` for detailed guide.

