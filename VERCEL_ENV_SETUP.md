# Quick Guide: Add Firebase Credentials to Vercel

## 🎯 What You Need

You already have your Firebase JSON file at:
```
app/firebase/billingsolution-firebase-adminsdk-fbsvc-716c6a10d0.json
```

## 📋 Step-by-Step Instructions

### Step 1: Get the Base64 String

Run this command in your terminal:

```bash
node scripts/prepare-firebase-env.js app/firebase/billingsolution-firebase-adminsdk-fbsvc-716c6a10d0.json
```

### Step 2: Copy the Base64 String

From the output, find the section that says:
```
OPTION 2: Base64 Encoded (for production/Vercel)
```

Copy the **entire long string** that comes after `FIREBASE_ADMIN_CREDENTIALS=`

It will look something like:
```
eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwicHJvamVjdF9pZCI6ImJpbGxpbmdzb2x1dGlvbiIsInByaXZhdGVfa2V5X2lkIjoiNzE2YzZhMTBkMDAzM2Q0YzljZWJiMGMxNjdhMzJiYTI4ZDE1MDBjZiIsInByaXZhdGVfa2V5IjoiLS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tXG5NSUlFdmdJQkFEQU5CZ2txaGtpRzl3MEJBUUVGQUFTQ0JLZ3dnZ1NrQWdFQUFvSUJBUUN0VTRvcWpZTnA4MVI1XG50bEVTZFFFc040VFB6cjAxYmJuczJTcE9SYmJ6SERWOWE0ZFZ5NTJvVDh6NlNlS2RzQms4YmsrZE5KeVBMTnJzXG5qVUpzNU44UkdYTWYrRXFjYTQ1RnBvejR6MFZnaE9QZ0RKWk94ZHVWTUQwQzU4M25pUzhuRkFvTlBVSmVSUkdVXG5CU2NpWGp1Y2J0YzJpZkZzWmtDK1htbEliTXBoOVh5TFB3eG5HbVBqVmhWcnJ4bFd2RzhOTnI5ZnBycUgrUW9MXG5TVCthd3JpdjRWZnFieEhHbmdXQUFzZll4YTBySkxKZFpjZnZIMW9zVHE2RGx6VTZlbUpKSkd5cWpnSUc1NTN1XG5udFRML2g4ZkhibVdNZlZIdDFHaGJVYTAwWVVZTnMvMWU4d2YxL0k2QldGTlJhd1VPakRwalZIUGRBWjl5MHh0XG5jWnVya3dFZkFnTUJBQUVDZ2dFQVRLRzhXeThCRktWOFNtbkVzMnZlemwxbmozZEE2Vy92Zlp2UVhCWHZtdEgwXG5obFMxMjhWd0dadmFyU2hnbE1ab2lmTGRxVXc3RWdSTGNMM055aFp3MTM4UWl1aDhtR2JuV3IwVjQrWEVMelhpXG5DRXVZWXhDUWtvZm0yYk9DTW1YUlhxNDUrWHVGcmVkTXE4eVJibDBLYnhJRWZmMEVMQ0NUYkhlU2hlNXZsbG8zXG43RDRzS2p1U0Fpc08vcGliY1ZUNG5hcndLdHhKaE9ZWXpwb2pZcXB5ejZ5T0c3OHY2WW5tV1ExQmFlTzkzY2RBXG5qQTRIZHN5ME50ajZtSzEyZm9JT3AxYnMzcUlhSXoxejkxL29pT1E0OEtuQTRuUGYrSXJob1ZHMitPR2t6aG5CXG5HRkdXUmlncjZqYW5NdEhJSVBqK1FZV3cvc0NMMHdkcXJyWGxnbDQ1U1FLQmdRRGlYV2pUK0ZUMWduVlpuQlhsXG5uWGlLdFFwbzFaQ0hlVzdYMm1ZNmpKZlR2WkplYkgwa0d6Z0VMcXppRUZaUXUyN0h0aFkzK05rZ2hiczVWbDlKXG51WHBqQjN3QU1CeGpGWk9ma2w1R1NFTjJzMjlzVjBqUWNuRXM3MXczMDRvSXU3eDdwcjB5ZjFXbmI3NGFiOFlmXG5aN3YyRmNXdFhGUnVvRUJyTWxibVY0bCs2UUtCZ1FERUJJeTllZVI0a215YXMwRTBZTVlyYnpicllxRTVkTVlKXG4yQTBFYThOY2FibG1LMVNOZXZka0xZMTd6aVFkZUFLVmxTTHNUOWV5MXpLd0d1Tzg4WVhSOXVtbGl4cEI2M3ArXG5zeWVqWTU3TEszNFZneTVvTExHVzJ4eDVqL2dnc2dnU25reFNoQlFIczhRZ0xVRy9zSVowQlZUcUtLT2ZvRmNJXG5xMTdncTdKS3h3S0JnUUM2R0R6ejluWXlGL3hOblFwTGFMZ09vR05jYUNhWG1YZE1zVm5Wekh1Tk1ZNUJYa05MXG5DYTExa3NIQ1g5ZjJLd0VaNGxKRjFhajdHYllmbnloYlBjYWwzeU5NTEVGS0hCVHUzSy93YTd3NnU2MWdqaWxvXG5aSTB5ZWQyQWI4Sk5CN29lbGFkNCtrSDZrdHpnY3YrWUZmbnFoMStwOC92ZHJwVUhDNjF4VkluTzhRS0JnUURDXG5ETHNEakpzWW5lUTBGZ2NVQWtYTWsvSHJmcDJiRXJaRzRvS29nTUpMUjBMS0dWVkFKcDZvcHN2czUzc3JUVFpKXG52UFZ3dWU0UVZ5Z1AzTjdkbXNCZXhyQXhPUThLZVVLd0VVM0pXNExGSVU1Vm42TWVjRGh5M29GRytyYXFMM1Q4XG5jWWVmSEsvem5Bd3B5b1BQYjhMN01wZ0lvNml3Q3Z4K1VhREFqRmtaMndLQmdHNllsOWVsb3FvY0FqZ2h5VU5jXG5DUXp2WEg5a0tZSm1qalJjckF1eUhaUlREU29pb0tNbHM3anROaXZDOE8rZyt6VXJxT3pHV0ZWdFBQNlYycmFvXG51RElKV0lHcEh0NXRhQkhnYXRRUW1nUE5Vd0tYVzFZWWNDZ3pEa0ZVNFY1dWt4S0YwbnVmUm5peWJQMkcxZHlvXG4xV1hJaTJVa1EvVE1LWEM3T0tabzM3M2Fcbi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS1cbiIsImNsaWVudF9lbWFpbCI6ImZpcmViYXNlLWFkbWluc2RrLWZic3ZjQGJpbGxpbmdzb2x1dGlvbi5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsImNsaWVudF9pZCI6IjEwOTIyNTg0ODM1OTQwNTU3NzEwMCIsImF1dGhfdXJpIjoiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tL28vb2F1dGgyL2F1dGgiLCJ0b2tlbl91cmkiOiJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiIsImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6Imh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL29hdXRoMi92MS9jZXJ0cyIsImNsaWVudF94NTA5X2NlcnRfdXJsIjoiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vcm9ib3QvdjEvbWV0YWRhdGEveDUwOS9maXJlYmFzZS1hZG1pbnNkay1mYnN2YyU0MGJpbGxpbmdzb2x1dGlvbi5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsInVuaXZlcnNlX2RvbWFpbiI6Imdvb2dsZWFwaXMuY29tIn0=
```

### Step 3: Add to Vercel

1. **Go to Vercel Dashboard**
   - Visit [vercel.com](https://vercel.com)
   - Select your project

2. **Navigate to Environment Variables**
   - Click **Settings** (left sidebar)
   - Click **Environment Variables**

3. **Add New Variable**
   - Click **Add New** button
   - **Key**: `FIREBASE_ADMIN_CREDENTIALS`
   - **Value**: Paste the base64 string you copied (the entire long string)
   - **Environment**: Check all three boxes:
     - ✅ Production
     - ✅ Preview  
     - ✅ Development
   - Click **Save**

### Step 4: Redeploy

After adding the variable, you need to redeploy:

1. Go to **Deployments** tab
2. Find your latest deployment
3. Click the **three dots** (⋯) menu
4. Click **Redeploy**
5. Wait for deployment to complete

## ✅ Verify It Works

After redeployment:

1. Visit your Vercel app: `https://your-app.vercel.app`
2. Login as admin
3. Go to `/admin/license-seed`
4. Try generating a license
5. If it works, you're all set! ✅

## ⚠️ Important Notes

- ✅ **Don't add quotes** around the base64 string in Vercel
- ✅ **Copy the entire string** - it's very long (starts with `eyJ` and ends with `=` or `==`)
- ✅ **Select all environments** (Production, Preview, Development)
- ✅ **Redeploy** after adding the variable

## 🆘 Troubleshooting

**"Failed to initialize Firebase Admin" error:**
- Check that you copied the entire base64 string (no truncation)
- Verify no extra spaces were added
- Make sure you selected all environments
- Redeploy after adding the variable

**Still not working?**
- Double-check the base64 string by running the script again
- Make sure you're using the string from "OPTION 2: Base64 Encoded"
- Verify the variable name is exactly: `FIREBASE_ADMIN_CREDENTIALS` (case-sensitive)

