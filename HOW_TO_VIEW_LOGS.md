# How to View Logs in Electron Build

## Automatic Logging

The Electron app now automatically opens DevTools when it starts, so you can see all console logs immediately.

## Console Logs Location

### In DevTools (Recommended)
1. When you run the EXE, DevTools will automatically open
2. Go to the **Console** tab
3. You'll see logs prefixed with:
   - `[Electron]` - Main process logs
   - `[Renderer]` - Renderer process logs  
   - `[LicenseGuard]` - License verification logs

### In Terminal/Command Prompt
If you run the EXE from command line, you'll also see logs there:
```bash
cd "dist\win-unpacked"
"Billing Solutions.exe"
```

## What to Look For

### License Verification Flow
1. `[LicenseGuard] Effect started` - Component mounted
2. `[LicenseGuard] Setting welcome timeout (1.5s)` - Welcome screen timer
3. `[LicenseGuard] Starting license verification...` - License check begins
4. `[LicenseGuard] License check result:` - Result of check
5. `[LicenseGuard] License invalid or requires activation, redirecting...` - Redirect happening

### Common Issues

**If you see:**
- `[LicenseGuard] Hard timeout fired` - License check is hanging
- `[Electron] Failed to load URL` - File path issue
- `[LicenseGuard] Component unmounted` - Component cleanup issue

## Disable DevTools in Production

Once everything works, you can disable DevTools by editing `electron/main.js`:
```javascript
// Change this:
mainWindow.webContents.openDevTools();

// To this:
if (isDev) {
  mainWindow.webContents.openDevTools();
}
```


