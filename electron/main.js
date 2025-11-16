const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const { createServer } = require('http');
const { parse } = require('url');
const getPort = require('get-port');

let mainWindow;
let nextProcess;
let httpServer;
let nextApp;
let serverPort = null; // Will be set dynamically
let serverUrl = null; // Store complete URL
let isAppReady = false;

const isDev = process.env.NODE_ENV === 'development';

// Cache and user data paths
const userCachePath = path.join(os.tmpdir(), 'billing-solutions-cache');
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Billing Solutions');

app.setPath('userData', userDataPath);
app.setPath('cache', userCachePath);
app.commandLine.appendSwitch('disk-cache-dir', userCachePath);
app.commandLine.appendSwitch('disk-cache-size', '104857600');

console.log('[Electron] Cache directory:', userCachePath);
console.log('[Electron] User data directory:', userDataPath);

const getPreloadPath = () => {
  return app.isPackaged 
    ? path.join(__dirname, 'preload.js')
    : path.join(__dirname, 'preload.js');
};

// Start Next.js server ONCE before creating window
const startNextServer = async () => {
  // Prevent multiple starts
  if (serverUrl) {
    console.log('[Electron] Server already started:', serverUrl);
    return serverUrl;
  }

  if (isDev) {
    // In dev, assume server is already running
    serverPort = 3000;
    serverUrl = `http://127.0.0.1:${serverPort}`;
    console.log('[Electron] Using dev server:', serverUrl);
    return serverUrl;
  }

  try {
    const appPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'app')
      : path.join(__dirname, '..');
    
    console.log('[Electron] Starting Next.js server...');
    console.log('[Electron] App path:', appPath);
    
    // Find available port first (try 3000-3100)
    for (let port = 3000; port <= 3100; port++) {
      const availablePort = await getPort({ port });
      if (availablePort === port) {
        serverPort = availablePort;
        console.log(`[Electron] Found available port: ${serverPort}`);
        break;
      }
    }
    
    if (!serverPort) {
      throw new Error('Could not find available port in range 3000-3100');
    }
    
    // Change to app directory
    const originalCwd = process.cwd();
    process.chdir(appPath);
    
    // Start Next.js programmatically
    const next = require('next');
    nextApp = next({ dev: false, dir: appPath });
    
    console.log('[Electron] Preparing Next.js app...');
    await nextApp.prepare();
    console.log('[Electron] ✅ Next.js app prepared');
    
    const handle = nextApp.getRequestHandler();
    
    // Create HTTP server
    httpServer = createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    });
    
    // Start server
    await new Promise((resolve, reject) => {
      httpServer.listen(serverPort, '127.0.0.1', (err) => {
        if (err) {
          console.error(`[Electron] Failed to start server:`, err);
          reject(err);
          return;
        }
        serverUrl = `http://127.0.0.1:${serverPort}`;
        console.log(`[Electron] ✅ Server started:`, serverUrl);
        resolve();
      });
    });
    
    // Verify server is responding
    await verifyServer(serverUrl);
    
    // Restore working directory
    process.chdir(originalCwd);
    
    return serverUrl;
    
  } catch (error) {
    console.error('[Electron] Error starting server:', error);
    throw error;
  }
};

// Verify server is responding
const verifyServer = async (url, maxAttempts = 10) => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const isReady = await new Promise((resolve) => {
        const req = http.get(url, (res) => {
          console.log(`[Electron] Server check: ${res.statusCode}`);
          resolve(res.statusCode === 200 || res.statusCode === 304);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(2000, () => {
          req.destroy();
          resolve(false);
        });
      });
      
      if (isReady) {
        console.log('[Electron] ✅ Server verified ready');
        return true;
      }
    } catch (err) {
      console.log(`[Electron] Server check failed (${i + 1}/${maxAttempts})`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Server failed to respond after multiple attempts');
};

const createWindow = async () => {
  // Prevent multiple windows
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('[Electron] Window already exists, focusing...');
    mainWindow.focus();
    return;
  }

  const preloadPath = getPreloadPath();
  console.log('[Electron] Creating window...');
  console.log('[Electron] Preload path:', preloadPath);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      partition: 'persist:main',
    },
    icon: path.join(__dirname, '../public/favicon.ico'),
    show: false,
    backgroundColor: '#ffffff',
  });

  // Clear cache on startup
  if (!isDev) {
    mainWindow.webContents.session.clearCache().catch(err => {
      console.warn('[Electron] Could not clear cache:', err.message);
    });
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      if (isDev) {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  // Enhanced logging
  mainWindow.webContents.on('console-message', (event, level, message) => {
    const levels = ['verbose', 'info', 'warning', 'error'];
    console.log(`[Renderer ${levels[level] || 'unknown'}]:`, message);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[Electron] Page failed to load:', errorCode, errorDescription, validatedURL);
  });

  // Handle navigation errors with limited retries
  let loadRetries = 0;
  const maxLoadRetries = 2;
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -102 && loadRetries < maxLoadRetries && serverUrl) {
      loadRetries++;
      console.log(`[Electron] Retrying load (${loadRetries}/${maxLoadRetries})...`);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(serverUrl);
        }
      }, 2000);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Load the URL
  if (!serverUrl) {
    throw new Error('Server URL not available - server must start before window creation');
  }
  
  console.log('[Electron] Loading URL:', serverUrl);
  await mainWindow.loadURL(serverUrl);
};

// IPC Handlers
ipcMain.handle('ping', () => 'pong');

// Start Next.js dev server (dev mode only)
const startNextDevServer = () => {
  if (!isDev) return;
  
  nextProcess = spawn('npm', ['run', 'dev:next'], {
    shell: true,
    stdio: 'inherit',
  });

  nextProcess.on('error', (error) => {
    console.error('[Electron] Failed to start Next.js dev server:', error);
  });
};

// App lifecycle
app.whenReady().then(async () => {
  if (isAppReady) {
    console.log('[Electron] App already ready, ignoring...');
    return;
  }
  isAppReady = true;
  
  console.log('[Electron] ✅ App ready');
  
  try {
    if (isDev) {
      // Start dev server
      startNextDevServer();
      // Wait for dev server to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));
      serverUrl = 'http://127.0.0.1:3000';
    } else {
      // Start production server
      await startNextServer();
    }
    
    // Create window after server is ready
    await createWindow();
    
  } catch (error) {
    console.error('[Electron] Fatal error during startup:', error);
    app.quit();
  }
});

app.on('activate', () => {
  console.log('[Electron] Activate event');
  
  const allWindows = BrowserWindow.getAllWindows();
  
  if (allWindows.length === 0 && serverUrl) {
    console.log('[Electron] No windows, creating new one...');
    createWindow();
  } else if (allWindows.length > 0) {
    console.log('[Electron] Focusing existing window...');
    allWindows[0].focus();
  }
});

app.on('window-all-closed', () => {
  console.log('[Electron] All windows closed');
  
  if (process.platform !== 'darwin') {
    // Cleanup
    if (httpServer) {
      console.log('[Electron] Closing HTTP server...');
      httpServer.close();
    }
    if (nextProcess) {
      console.log('[Electron] Killing Next.js process...');
      nextProcess.kill();
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  console.log('[Electron] Before quit - cleaning up...');
  
  if (httpServer) {
    httpServer.close();
  }
  if (nextProcess) {
    nextProcess.kill();
  }
});

// Certificate errors (dev only)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (isDev) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});
