# Fix for Electron Cache Permission Errors

## Problem
When running the EXE, you see errors like:
```
ERROR:net\disk_cache\cache_util_win.cc:25] Unable to move the cache: Access is denied. (0x5)
ERROR:net\disk_cache\disk_cache.cc:236] Unable to create cache
ERROR:gpu\ipc\host\gpu_disk_cache.cc:724] Gpu Cache Creation failed: -2
```

## Root Cause
Electron tries to create cache files in the application directory, but:
- The app directory might be read-only (especially if installed in Program Files)
- Windows requires admin permissions to write to certain directories
- Cache files can't be created in protected system folders

## Solution Applied

### 1. Set Cache Directory to User's Temp Folder
- Changed cache location to `%TEMP%\billing-solutions-cache`
- Temp folder is always writable without admin permissions
- Each user has their own temp folder

### 2. Set User Data Directory
- Changed to `%APPDATA%\Billing Solutions`
- This is the standard location for app data
- Always writable for the current user

### 3. Disabled Cache in WebPreferences
- Set `cache: false` to prevent cache creation issues
- Session uses `persist:main` partition

### 4. Clear Cache on Startup
- Automatically clears old cache to avoid conflicts
- Sets cache path to temp folder

## What This Fixes

✅ No more "Access is denied" errors  
✅ No more "Unable to create cache" errors  
✅ App works without administrator permissions  
✅ Cache stored in user-accessible location  
✅ Works even if app is in Program Files  

## Testing

After rebuilding, run the EXE and you should see:
- No cache permission errors in terminal
- App loads normally
- Cache created in temp folder (can be safely ignored)

## Cache Location

Cache is now stored in:
- **Windows**: `C:\Users\<YourUsername>\AppData\Local\Temp\billing-solutions-cache`
- **User Data**: `C:\Users\<YourUsername>\AppData\Roaming\Billing Solutions`

Both locations are automatically cleaned up by Windows when temp files are cleared.


