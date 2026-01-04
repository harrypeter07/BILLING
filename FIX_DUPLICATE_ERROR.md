# Fix Duplicate Function Error

## Error Message
```
the name `generateInvoiceHTML` is defined multiple times
./app/api/invoices/[id]/html/route.ts:92:10
```

## Root Cause
This is a **build cache issue**. The `.next` folder contains stale compiled code from a previous version where the function was defined in the route file.

## Solution

### Step 1: Stop Dev Server
Press `Ctrl+C` in the terminal where `npm run dev` is running.

### Step 2: Delete Build Cache
```powershell
# In PowerShell
Remove-Item -Recurse -Force .next
```

Or manually delete the `.next` folder.

### Step 3: Restart Dev Server
```bash
npm run dev
```

## Why This Happened

The route file (`app/api/invoices/[id]/html/route.ts`) was previously updated to use the shared HTML generator from `lib/utils/invoice-html-generator.ts`, but the build cache still had the old version with the function defined locally.

## Verification

After clearing cache and restarting, the error should be gone. The route file now correctly imports:
```typescript
import { generateInvoiceHTML } from "@/lib/utils/invoice-html-generator";
```

Instead of defining the function locally.

