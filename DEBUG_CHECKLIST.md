# Debug Checklist - License Verification Issue

## What to Check

### 1. DevTools Console (Most Important!)
- **Press `Ctrl+Shift+I` or `F12`** in the app window
- Go to **Console** tab
- Look for these logs in order:

```
[Electron] Loading URL: ...
[Electron] DOM ready
[Electron] Page finished loading
[LicenseGuard] Effect started, pathname: ...
[LicenseGuard] isElectron: true/false
[LicenseGuard] Setting welcome timeout (1.5s)
[LicenseGuard] Starting license verification...
[LicenseGuard] License check result: ...
```

### 2. Terminal Output
- You should see `[Electron]` logs in terminal
- Renderer logs will show as `[Renderer info]:` etc.

### 3. Common Issues

**If you DON'T see `[LicenseGuard] Effect started`:**
- The component isn't mounting
- Check if the page is loading correctly
- Look for JavaScript errors in DevTools Console

**If you see `[LicenseGuard] Effect started` but nothing after:**
- The useEffect might be blocked
- Check for errors in the try/catch block
- Look for IndexedDB errors

**If you see timeout logs:**
- `[LicenseGuard] Hard timeout fired` - License check is hanging
- This means `checkLicenseOnLaunch()` is taking too long

**If pathname is wrong:**
- Check `[LicenseGuard] Effect started, pathname: ...`
- Should be `/` not `/license` on first load

### 4. Quick Test

Open DevTools Console and manually run:
```javascript
// Check if Electron is detected
console.log('electronAPI:', window.electronAPI);

// Check pathname
console.log('pathname:', window.location.pathname);

// Try redirect manually
window.location.href = '/license';
```

### 5. What the Logs Tell Us

**Good flow:**
1. `[LicenseGuard] Effect started, pathname: /` ✅
2. `[LicenseGuard] Setting welcome timeout (1.5s)` ✅
3. `[LicenseGuard] Starting license verification...` ✅
4. `[LicenseGuard] License check result: {valid: false, requiresActivation: true}` ✅
5. `[LicenseGuard] License invalid or requires activation, redirecting...` ✅
6. Page should redirect to `/license`

**Bad flow (stuck):**
1. `[LicenseGuard] Effect started` ✅
2. `[LicenseGuard] Setting welcome timeout` ✅
3. `[LicenseGuard] Starting license verification...` ✅
4. **Nothing after this** ❌ = `checkLicenseOnLaunch()` is hanging
5. After 3 seconds: `[LicenseGuard] Hard timeout fired` ✅

## Next Steps Based on Logs

**If stuck at step 4:**
- The issue is in `checkLicenseOnLaunch()` function
- Check `lib/utils/license-manager.ts`
- Look for IndexedDB or MAC address errors

**If no logs at all:**
- JavaScript isn't loading
- Check for syntax errors
- Check if React is mounting


