# Fix for Electron Builder Symlink Permission Issue

## Problem
Electron-builder fails with: "ERROR: Cannot create symbolic link: A required privilege is not held by the client."

## Root Cause
Windows requires administrator privileges or Developer Mode to create symbolic links. The `winCodeSign` tool that electron-builder downloads contains symlinks that fail to extract.

## Solutions Implemented

### 1. Automatic Cache Clearing
The build scripts now automatically clear the `winCodeSign` cache before building to prevent the issue.

### 2. Disabled Code Signing
- `forceCodeSigning: false` in package.json
- `CSC_IDENTITY_AUTO_DISCOVERY=false` environment variable
- `WIN_CSC_LINK=` (empty) to prevent code signing tool usage

### 3. Permanent Fix Options

#### Option A: Enable Developer Mode (Recommended - No Admin Needed)
1. Open Windows Settings (Win + I)
2. Go to **Privacy & Security** → **For developers**
3. Enable **Developer Mode**
4. Restart your terminal/VS Code
5. Run `npm run dist:win` again

This allows creating symlinks without administrator privileges.

#### Option B: Run Build as Administrator
1. Right-click PowerShell or Command Prompt
2. Select **"Run as Administrator"**
3. Navigate to project directory
4. Run `npm run dist:win`

#### Option C: Manual Cache Deletion (Before Each Build)
If the above don't work, manually delete the cache before building:
```powershell
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
```

## Why This Happens
Electron-builder downloads `winCodeSign` for code signing, even when code signing is disabled. The archive contains macOS library files (`.dylib`) with symlinks that Windows can't extract without special permissions.

## Current Status
✅ Cache clearing script added  
✅ Code signing disabled  
✅ Environment variables set  
⚠️ Still requires Developer Mode or Admin for first-time extraction

The build will work once you enable Developer Mode or run as Administrator. After the first successful build, the cache will be properly extracted and future builds should work normally.



