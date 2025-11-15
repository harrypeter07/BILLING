# Fixing Electron Builder Symlink Permission Issue

## Problem
Electron-builder fails with: "ERROR: Cannot create symbolic link: A required privilege is not held by the client."

This happens because Windows requires special permissions to create symbolic links.

## Root Cause
The `winCodeSign` tool that electron-builder downloads tries to create symbolic links when extracting, which requires administrator privileges on Windows.

## Solutions Applied

### 1. Automatic Cache Clearing
The build scripts now automatically clear the problematic `winCodeSign` cache before building.

### 2. Disabled Code Signing
- `forceCodeSigning: false` - Prevents code signing
- `CSC_IDENTITY_AUTO_DISCOVERY=false` - Disables automatic code signing discovery
- All signing-related configs set to `null`

### 3. Manual Fix (If Needed)

If you still encounter the issue, you can manually clear the cache:

```powershell
# Run PowerShell as Administrator, then:
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
```

Or delete the entire cache:
```powershell
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache"
```

### 4. Alternative: Enable Developer Mode (Windows 10/11)

1. Open Settings → Update & Security → For developers
2. Enable "Developer Mode"
3. This allows creating symlinks without admin privileges

### 5. Alternative: Run Build as Administrator

Right-click PowerShell/Command Prompt and select "Run as Administrator", then run:
```bash
npm run dist:win
```

## Prevention

The build scripts now automatically:
- Clear the winCodeSign cache before building
- Set environment variables to skip code signing
- Use local cache directory to avoid system-wide issues

This should prevent the issue from occurring in the future.

