# How to Kill Running Billing Solutions Processes

## Problem
Even when the app window is closed, the process might still be running in the background, causing "Access is denied" errors when rebuilding.

## Quick Fix - Manual Method

### Option 1: Task Manager (Easiest)
1. Press `Ctrl + Shift + Esc` to open Task Manager
2. Look for "Billing Solutions.exe" or "electron.exe"
3. Right-click → End Task
4. If it says "Access Denied", click "End Process" (may need admin)

### Option 2: Command Line (PowerShell)
```powershell
# Kill Billing Solutions
taskkill /F /IM "Billing Solutions.exe"

# Kill all Electron processes
taskkill /F /IM electron.exe

# Or kill by window title
taskkill /FI "WINDOWTITLE eq Billing Solutions*" /F
```

### Option 3: Using the Script
```powershell
node scripts/kill-electron-processes.js
```

## Automatic Fix

The build script now automatically kills processes before building. Just run:
```powershell
npm run dist:win
```

It will:
1. Kill any running Billing Solutions processes
2. Clear cache
3. Build the app

## Why This Happens

Electron apps sometimes keep processes running in the background even after closing the window. This is normal behavior but can cause file locking issues during rebuilds.

## Prevention

The build script now handles this automatically, so you shouldn't need to manually kill processes anymore.

