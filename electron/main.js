const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

let mainWindow;
let nextProcess;

const isDev = process.env.NODE_ENV === 'development';

// Fix cache permission issues by setting cache directory to user's temp folder
// This prevents "Access is denied" errors when Electron tries to create cache
// Must be called BEFORE app.whenReady()
const userCachePath = path.join(os.tmpdir(), 'billing-solutions-cache');
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Billing Solutions');

// Set paths before app is ready
app.setPath('userData', userDataPath);
app.setPath('cache', userCachePath);

// Use command line switch to set cache location (works for Chromium cache)
app.commandLine.appendSwitch('disk-cache-dir', userCachePath);
app.commandLine.appendSwitch('disk-cache-size', '104857600'); // 100MB cache limit

console.log('[Electron] Cache directory set to:', userCachePath);
console.log('[Electron] User data directory:', userDataPath);

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      // Disable cache to prevent permission errors
      partition: 'persist:main',
      cache: false,
    },
    icon: path.join(__dirname, '../public/favicon.ico'),
    show: false, // Don't show until ready
    backgroundColor: '#ffffff', // White background for splash
  });

  // Clear cache on startup to avoid permission issues
  if (!isDev) {
    const session = mainWindow.webContents.session;
    
    // Clear cache on startup to avoid permission issues
    session.clearCache().catch(err => {
      console.warn('[Electron] Could not clear cache:', err.message);
    });
    
    // Disable cache if still having issues (optional - uncomment if needed)
    // session.clearStorageData().catch(err => {
    //   console.warn('[Electron] Could not clear storage:', err.message);
    // });
    
    console.log('[Electron] Cache cleared, using temp directory:', userCachePath);
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Always open DevTools for debugging (can be disabled in production later)
    mainWindow.webContents.openDevTools();
    console.log('[Electron] Window shown, DevTools opened');
  });

  // Handle navigation to ensure license page loads correctly
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    // If navigation fails, try to load license page directly
    if (!isDev) {
      console.log('[Electron] Navigation failed:', errorDescription, 'URL:', validatedURL);
      if (validatedURL && validatedURL.includes('license')) {
        // License page failed to load, try direct path
        const licensePath = path.join(__dirname, '../out/license/index.html');
        console.log('[Electron] Trying to load license page from:', licensePath);
        mainWindow.loadURL(`file://${licensePath}`).catch((err) => {
          console.error('[Electron] Failed to load license page:', err);
          // Fallback to index
          mainWindow.loadURL(`file://${path.join(__dirname, '../out/index.html')}`);
        });
      } else if (validatedURL && !validatedURL.includes('license')) {
        // Other page failed, redirect to license
        console.log('[Electron] Redirecting to license page');
        const licensePath = path.join(__dirname, '../out/license/index.html');
        mainWindow.loadURL(`file://${licensePath}`).catch(() => {
          // Fallback to index
          mainWindow.loadURL(`file://${path.join(__dirname, '../out/index.html')}`);
        });
      }
    }
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../out/index.html')}`;

  console.log('[Electron] Loading URL:', startUrl);
  console.log('[Electron] isDev:', isDev);
  console.log('[Electron] __dirname:', __dirname);
  
  // Log all console messages from renderer to terminal
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelStr = ['verbose', 'info', 'warning', 'error'][level] || 'unknown';
    console.log(`[Renderer ${levelStr}]:`, message);
  });

  // Also log when page loads
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Electron] Page finished loading');
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('[Electron] DOM ready');
  });
  
  mainWindow.loadURL(startUrl).catch((error) => {
    console.error('[Electron] Failed to load URL:', error);
    if (!isDev) {
      // Fallback: try loading from different path
      const altPath = `file://${path.join(process.resourcesPath, 'out/index.html')}`;
      console.log('[Electron] Trying alternative path:', altPath);
      mainWindow.loadURL(altPath);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Start Next.js server in development
const startNextServer = () => {
  if (isDev) {
    nextProcess = spawn('npm', ['run', 'dev:next'], {
      shell: true,
      stdio: 'inherit',
    });

    nextProcess.on('error', (error) => {
      console.error('Failed to start Next.js server:', error);
    });
  }
};

// IPC Handlers
ipcMain.handle('ping', () => {
  return 'pong';
});

app.whenReady().then(() => {
  if (isDev) {
    startNextServer();
    // Wait a bit for Next.js to start
    setTimeout(() => {
      createWindow();
    }, 3000);
  } else {
    createWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (nextProcess) {
      nextProcess.kill();
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  if (nextProcess) {
    nextProcess.kill();
  }
});

// Handle certificate errors (for development)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (isDev) {
    // In development, ignore certificate errors
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

