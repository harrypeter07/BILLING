const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const { createServer } = require('http');
const { parse } = require('url');
const getPortModule = require('get-port');
const getPort = getPortModule.default || getPortModule;

let mainWindow;
let nextProcess;
let httpServer;
let nextApp;
let serverPort = null; // Will be set dynamically
let serverUrl = null; // Store complete URL
let isAppReady = false;
let isCreatingWindow = false; // Prevent multiple window creation

const isDev = process.env.NODE_ENV === 'development';

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[Electron] Another instance is already running, quitting...');
  app.quit();
  process.exit(0);
} else {
  // Handle second instance - focus existing window
  app.on('second-instance', () => {
    console.log('[Electron] Second instance detected, focusing existing window...');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

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
  // In production, electron is unpacked, so __dirname points to resources/app.asar.unpacked/electron
  // In dev, __dirname points to electron/
  return path.join(__dirname, 'preload.js');
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
    let appPath;
    let resourcesPath;
    let asarPath;
    let unpackedPath;
    if (app.isPackaged) {
      // When packaged, files are in resources/app.asar (ASAR enabled)
      // .next and electron directories are unpacked for direct file access
      resourcesPath = process.resourcesPath;
      asarPath = path.join(resourcesPath, 'app.asar');
      unpackedPath = path.join(resourcesPath, 'app.asar.unpacked');
      
      // Check if unpacked directory exists (for .next and electron)
      if (fs.existsSync(unpackedPath)) {
        // Use unpacked path as base - .next is unpacked here
        appPath = unpackedPath;
        console.log('[Electron] Using unpacked app directory from resources');
      } else if (fs.existsSync(asarPath)) {
        // Fallback to ASAR if unpacked doesn't exist
        appPath = asarPath;
        console.log('[Electron] Using ASAR app directory from resources');
      } else {
        console.error('[Electron] App path does not exist (checked both ASAR and unpacked)');
        console.error('[Electron] Resources path:', resourcesPath);
        console.error('[Electron] Available in resources:', fs.existsSync(resourcesPath) ? fs.readdirSync(resourcesPath) : 'N/A');
        throw new Error(`App path does not exist. Checked: ${asarPath} and ${unpackedPath}`);
      }
      
      // Verify .next directory exists (required for Next.js server)
      // It should be in unpacked directory since we configured asarUnpack
      const nextBuildPath = path.join(appPath, '.next');
      if (!fs.existsSync(nextBuildPath)) {
        console.error('[Electron] .next build directory not found at:', nextBuildPath);
        console.error('[Electron] Available files in app:', fs.existsSync(appPath) ? fs.readdirSync(appPath) : 'N/A');
        throw new Error(`Next.js build directory (.next) not found at: ${nextBuildPath}. Please ensure the app is built correctly.`);
      }
    } else {
      appPath = path.join(__dirname, '..');
    }
    
    console.log('[Electron] Starting Next.js server...');
    console.log('[Electron] App path:', appPath);
    console.log('[Electron] .next exists:', fs.existsSync(path.join(appPath, '.next')));
    
    // Find available port in range 3000-3100
    // Use getPort with host specified to avoid TIME_WAIT issues
    serverPort = null;
    try {
      // Try to get a port starting from 3000
      serverPort = await getPort({ port: 3000, host: '127.0.0.1' });
      // If we got a port outside our range, try to find one in range
      if (serverPort < 3000 || serverPort > 3100) {
        for (let port = 3000; port <= 3100; port++) {
          const testPort = await getPort({ port, host: '127.0.0.1' });
          if (testPort === port) {
            serverPort = testPort;
            break;
          }
        }
      }
    } catch (err) {
      console.warn('[Electron] Error finding port, using fallback:', err.message);
    }

    // Fallback: if no port in range, use any available port
    if (!serverPort || serverPort > 3100) {
      console.warn('[Electron] No port available in range 3000-3100, using any available port');
      try {
        serverPort = await getPort({ host: '127.0.0.1' });
      } catch (err) {
        console.error('[Electron] Failed to find any available port:', err);
        throw new Error('Could not find an available port for the server');
      }
    }
    console.log(`[Electron] Found available port: ${serverPort}`);
    
    // Change to app directory (now safe since we're using unpacked or regular app dir)
    const originalCwd = process.cwd();
    process.chdir(appPath);
    
    // In packaged mode, we need to make sure Next.js can find its modules
    // Modules are now in the ASAR or unpacked
    if (app.isPackaged && resourcesPath) {
      const asarNodeModules = path.join(asarPath, 'node_modules'); // Main app's node_modules in ASAR
      const unpackedNodeModules = unpackedPath ? path.join(unpackedPath, 'node_modules') : null;
      
      const nodePath = process.env.NODE_PATH || '';
      const paths = nodePath ? nodePath.split(path.delimiter) : [];
      
      // Add main app's node_modules from ASAR (where Next.js is)
      if (fs.existsSync(asarNodeModules) && !paths.includes(asarNodeModules)) {
        paths.push(asarNodeModules);
      }
      
      // Also add the unpacked node_modules if it exists (for unpacked modules)
      if (unpackedNodeModules && fs.existsSync(unpackedNodeModules) && !paths.includes(unpackedNodeModules)) {
        paths.push(unpackedNodeModules);
      }
      
      process.env.NODE_PATH = paths.join(path.delimiter);
      
      // Add to module.paths for require resolution
      if (fs.existsSync(asarNodeModules) && !module.paths.includes(asarNodeModules)) {
        module.paths.push(asarNodeModules);
      }
      if (unpackedNodeModules && fs.existsSync(unpackedNodeModules) && !module.paths.includes(unpackedNodeModules)) {
        module.paths.push(unpackedNodeModules);
      }
      
      console.log('[Electron] Module paths configured:', {
        asarNodeModules: fs.existsSync(asarNodeModules),
        unpackedNodeModules: unpackedNodeModules ? fs.existsSync(unpackedNodeModules) : false
      });
    }
    
    // Start Next.js programmatically
    const next = require('next');
    nextApp = next({ dev: false, dir: appPath });
    
    console.log('[Electron] Preparing Next.js app...');
    await nextApp.prepare();
    console.log('[Electron] ✅ Next.js app prepared');
    
    const handle = nextApp.getRequestHandler();
    
    // Create HTTP server with error handling
    httpServer = createServer((req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl).catch((err) => {
          console.error('[Electron] Request handler error:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end('Internal Server Error');
          }
        });
      } catch (err) {
        console.error('[Electron] Server request error:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      }
    });
    
    // Start server with retry logic
    const maxRetries = 5;
    let currentPort = serverPort;
    let serverStarted = false;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Close previous server if it exists
        if (httpServer && httpServer.listening) {
          httpServer.close();
          await new Promise(resolve => {
            if (httpServer.listening) {
              httpServer.once('close', resolve);
            } else {
              resolve();
            }
          });
        }
        
        // Create a new server for each attempt to avoid binding issues
        httpServer = createServer((req, res) => {
          try {
            const parsedUrl = parse(req.url, true);
            handle(req, res, parsedUrl).catch((err) => {
              console.error('[Electron] Request handler error:', err);
              if (!res.headersSent) {
                res.statusCode = 500;
                res.end('Internal Server Error');
              }
            });
          } catch (err) {
            console.error('[Electron] Server request error:', err);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.end('Internal Server Error');
            }
          }
        });
        
        // Handle server errors (but don't let them stop the retry loop)
        httpServer.on('error', (err) => {
          if (err.code !== 'EADDRINUSE') {
            console.error('[Electron] HTTP server error:', err);
          }
        });
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Server start timeout'));
          }, 10000);
          
          const errorHandler = (err) => {
            clearTimeout(timeout);
            httpServer.removeListener('error', errorHandler);
            reject(err);
          };
          
          httpServer.once('error', errorHandler);
          
          httpServer.listen(currentPort, '127.0.0.1', () => {
            clearTimeout(timeout);
            httpServer.removeListener('error', errorHandler);
            serverPort = currentPort;
            serverUrl = `http://127.0.0.1:${serverPort}`;
            console.log(`[Electron] ✅ Server started on port ${serverPort}:`, serverUrl);
            serverStarted = true;
            resolve();
          });
        });
        
        break; // Success, exit retry loop
        
      } catch (err) {
        if (attempt === maxRetries) {
          throw new Error(`Failed to start server after ${maxRetries} attempts: ${err.message}`);
        }
        
        if (err.code === 'EADDRINUSE') {
          console.warn(`[Electron] Port ${currentPort} in use, finding next available port (attempt ${attempt}/${maxRetries})...`);
          // Get a new port for next attempt
          try {
            currentPort = await getPort({ port: currentPort + 1, host: '127.0.0.1' });
            serverPort = currentPort;
            console.log(`[Electron] Trying port ${currentPort}...`);
          } catch (portErr) {
            // If we can't get a specific port, try any available port
            currentPort = await getPort({ host: '127.0.0.1' });
            serverPort = currentPort;
            console.log(`[Electron] Using any available port: ${currentPort}...`);
          }
        }
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
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
const verifyServer = async (url, maxAttempts = 15) => {
  console.log(`[Electron] Verifying server at ${url}...`);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const isReady = await new Promise((resolve) => {
        const req = http.get(url, (res) => {
          console.log(`[Electron] Server check ${i + 1}/${maxAttempts}: ${res.statusCode}`);
          // Accept 200, 304, or even 404/500 as long as server responds (means it's running)
          resolve(res.statusCode >= 200 && res.statusCode < 600);
        });
        req.on('error', (err) => {
          console.log(`[Electron] Server check ${i + 1}/${maxAttempts} error:`, err.message);
          resolve(false);
        });
        req.setTimeout(3000, () => {
          req.destroy();
          resolve(false);
        });
      });
      
      if (isReady) {
        console.log('[Electron] ✅ Server verified ready and responding');
        return true;
      }
    } catch (err) {
      console.log(`[Electron] Server check ${i + 1}/${maxAttempts} exception:`, err.message);
    }
    
    if (i < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.warn('[Electron] ⚠ Server verification failed, but continuing anyway...');
  // Don't throw - server might be starting slowly
  return false;
};

const createWindow = async () => {
  // Prevent multiple windows
  if (isCreatingWindow) {
    console.log('[Electron] Window creation already in progress, waiting...');
    // Wait for existing creation to complete
    while (isCreatingWindow) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('[Electron] Window created by another process, focusing...');
      mainWindow.focus();
      return;
    }
  }
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('[Electron] Window already exists, focusing...');
    mainWindow.focus();
    return;
  }
  
  isCreatingWindow = true;

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
      // Enable IndexedDB for license storage
      enableBlinkFeatures: 'IndexedDB',
    },
    icon: app.isPackaged 
      ? path.join(process.resourcesPath, 'public', 'favicon.ico')
      : path.join(__dirname, '../public/favicon.ico'),
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
  
  // Wait a bit to ensure server is fully ready
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Load with error handling
  try {
    await mainWindow.loadURL(serverUrl);
    console.log('[Electron] ✅ Window loaded successfully');
  } catch (err) {
    console.error('[Electron] Failed to load URL:', err);
    // Retry once after a delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      await mainWindow.loadURL(serverUrl);
      console.log('[Electron] ✅ Window loaded successfully on retry');
    } catch (retryErr) {
      console.error('[Electron] Failed to load URL on retry:', retryErr);
      throw retryErr;
    }
  }
  
  isCreatingWindow = false;
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

app.on('activate', async () => {
  console.log('[Electron] Activate event');
  
  const allWindows = BrowserWindow.getAllWindows();
  
  if (allWindows.length === 0) {
    if (serverUrl) {
      console.log('[Electron] No windows, creating new one...');
      await createWindow();
    } else {
      console.log('[Electron] Server not ready yet, waiting...');
      // Wait a bit for server to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (serverUrl) {
        await createWindow();
      }
    }
  } else {
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
