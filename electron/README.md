# Electron Setup for Billing Solutions

This directory contains the Electron main process files for the desktop application.

## Files

- `main.js` - Main Electron process that creates and manages the browser window
- `preload.js` - Secure bridge between Electron and the Next.js renderer process
- `package.json` - Electron package configuration

## Development

Run the development environment:
```bash
npm run dev
```

This will:
1. Start Next.js dev server on `http://localhost:3000`
2. Wait for the server to be ready
3. Launch Electron window pointing to the dev server

## Building for Production

### Build static Next.js export:
```bash
npm run build:export
```

### Create distributable:
```bash
# For Windows
npm run dist:win

# For macOS
npm run dist:mac

# For Linux
npm run dist:linux

# For all platforms
npm run dist
```

The built executables will be in the `dist/` directory.

## Notes

- Dexie (IndexedDB) works seamlessly in Electron - no changes needed
- Firebase authentication and Firestore work via HTTPS endpoints
- All existing web logic remains unchanged
- The app runs offline-first with local Dexie storage


