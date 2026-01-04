# Vercel Puppeteer Compatibility

## Issue

Puppeteer doesn't work well on Vercel serverless functions because:

1. Large package size (exceeds function limits)
2. Requires Chrome/Chromium binaries
3. Serverless functions have execution time limits

## Solution Options

### Option 1: Use Puppeteer Core with Chromium (Recommended for Vercel)

Replace `puppeteer` with `puppeteer-core` + `@sparticuz/chromium`:

```bash
npm install puppeteer-core @sparticuz/chromium
```

Then update the routes to use:

```typescript
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

// In the route:
const browser = await puppeteer.launch({
	args: chromium.args,
	defaultViewport: chromium.defaultViewport,
	executablePath: await chromium.executablePath(),
	headless: chromium.headless,
});
```

### Option 2: Use Client-Side Only (Current Fallback)

The current implementation already falls back to client-side (jsPDF + html2canvas) when offline or if server fails. This works on Vercel but requires client-side processing.

### Option 3: Use External PDF Service

Use a service like:

- PDFShift
- HTMLPDF API
- Browserless.io

## Current Status

- ✅ `puppeteer` added to package.json
- ⚠️ May not work on Vercel (will fall back to client-side)
- ✅ Client-side fallback already implemented

## Recommendation

For production on Vercel, consider:

1. Using `puppeteer-core` + `@sparticuz/chromium` (Option 1)
2. Or rely on client-side generation (Option 2) - already implemented
