# Electron Desktop App Setup

This document describes the Electron integration for the Billing Solutions desktop application.

## 📁 Structure

```
billing-solutions/
├── electron/
│   ├── main.js          # Main Electron process
│   ├── preload.js       # Secure bridge for IPC
│   ├── package.json     # Electron package config
│   └── README.md        # Electron-specific docs
├── package.json         # Updated with Electron scripts
└── next.config.mjs      # Updated for static export
```

## 🚀 Quick Start

### Development Mode

Run both Next.js and Electron simultaneously:

```bash
npm run dev
```

This will:
1. Start Next.js dev server on `http://localhost:3000`
2. Wait for server to be ready
3. Launch Electron window connected to dev server
4. Open DevTools automatically in development

### Production Build

Build the desktop application:

```bash
# Build for Windows
npm run dist:win

# Build for macOS  
npm run dist:mac

# Build for Linux
npm run dist:linux

# Build for all platforms
npm run dist
```

Output will be in the `dist/` directory:
- **Windows**: `.exe` installer (NSIS)
- **macOS**: `.dmg` and `.zip`
- **Linux**: `.AppImage` and `.deb`

## 🔧 Configuration

### Package.json Scripts

- `dev` - Run Next.js + Electron in development
- `dev:next` - Run only Next.js dev server
- `dev:electron` - Run only Electron (waits for Next.js)
- `build:export` - Build Next.js as static export for Electron
- `dist` - Build and package for all platforms
- `dist:win` - Build Windows executable
- `dist:mac` - Build macOS app
- `dist:linux` - Build Linux packages

### Electron Builder Config

Located in `package.json` under `"build"`:
- App ID: `com.billingsolutions.app`
- Product Name: `Billing Solutions`
- Output: `dist/` directory
- Includes: `out/`, `electron/`, `public/`, and required node_modules

## 🔐 Security

- **Context Isolation**: Enabled (secure)
- **Node Integration**: Disabled (secure)
- **Preload Script**: Secure bridge for IPC communication
- **Web Security**: Enabled

## 💾 Data Storage

### Dexie (IndexedDB)
- Works seamlessly in Electron
- Data persists in user's browser storage
- No code changes needed
- Fully offline-capable

### Firebase
- Authentication via HTTPS
- Firestore/Realtime DB via HTTPS
- Works exactly as in web version
- No configuration changes needed

## 🧪 Testing

### Verify Dexie Storage

Open DevTools in Electron and run:

```javascript
// Check IndexedDB databases
indexedDB.databases().then(dbs => console.log('Databases:', dbs));

// Access Dexie
// Your existing Dexie code works as-is
```

### Test Electron API

The preload script exposes `window.electronAPI`:

```javascript
// Test ping
window.electronAPI?.ping().then(console.log); // "pong"

// Check platform
console.log(window.electronAPI?.platform); // "win32", "darwin", or "linux"

// Check versions
console.log(window.electronAPI?.versions);
```

## 📦 Building for Distribution

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build static export:
   ```bash
   npm run build:export
   ```

3. Package for distribution:
   ```bash
   npm run dist:win  # or dist:mac, dist:linux
   ```

### Build Output

- **Windows**: `dist/Billing Solutions Setup x.x.x.exe`
- **macOS**: `dist/Billing Solutions-x.x.x.dmg`
- **Linux**: `dist/Billing Solutions-x.x.x.AppImage`

## 🎯 Features

### Current
- ✅ Desktop window with Next.js app
- ✅ Development mode with hot reload
- ✅ Production static export
- ✅ Secure IPC bridge
- ✅ Dexie offline storage
- ✅ Firebase integration

### Future Enhancements (Ready to implement)
- 📄 PDF invoice generation
- 💾 File save/export dialogs
- 🖨️ Print functionality
- 📤 Auto-sync with cloud
- 🔔 Desktop notifications
- 📋 System tray integration

## 🐛 Troubleshooting

### Electron window is blank
- Check that Next.js dev server is running on port 3000
- Check console for errors
- Verify `out/` directory exists after build

### Build fails
- Ensure all dependencies are installed: `npm install`
- Check that `build:export` completes successfully
- Verify electron-builder is installed: `npm list electron-builder`

### Dexie not working
- Open DevTools and check IndexedDB
- Verify no CORS issues
- Check browser console for errors

## 📝 Notes

- The app runs offline-first with Dexie
- Firebase requires internet connection for auth/sync
- All existing web code works without changes
- Static export is only used for Electron builds
- Regular Next.js builds remain unchanged


