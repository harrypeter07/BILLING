const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const { createServer } = require('http');
const { parse } = require('url');

let mainWindow;
let nextProcess; // Fallback: spawned process (if programmatic fails)
let httpServer; // Main: programmatic Next.js server
let nextApp; // Next.js app instance (for cleanup)
let isCreatingWindow = false; // Prevent multiple window creation
let isServerStarting = false; // Prevent multiple server starts

const isDev = process.env.NODE_ENV === 'development';
const PORT = 3000;

// Helper function to check if a port is in use
const checkPortInUse = (port) => {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(false));
      server.close();
    });
    server.on('error', () => resolve(true));
  });
};

// Helper function to find an available port
const findAvailablePort = async (startPort = 3000, maxAttempts = 10) => {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const inUse = await checkPortInUse(port);
    if (!inUse) {
      return port;
    }
  }
  return null;
};

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

// Get preload path - works in both dev and packaged mode
const getPreloadPath = () => {
  if (app.isPackaged) {
    // In packaged app, preload.js is in the same directory as main.js
    // Since asar is disabled, files are unpacked in resources/app/electron/
    return path.join(__dirname, 'preload.js');
  }
  // Dev mode
  return path.join(__dirname, 'preload.js');
};

const createWindow = () => {
  // Prevent multiple windows - check flag first
  if (isCreatingWindow) {
    console.log('[Electron] Window creation already in progress, skipping...');
    return;
  }
  
  // Prevent multiple windows - check if window exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('[Electron] Window already exists, focusing instead of creating new one');
    mainWindow.focus();
    return;
  }
  
  // Set flag to prevent concurrent creation
  isCreatingWindow = true;

  const preloadPath = getPreloadPath();
  console.log('[Electron] Preload path:', preloadPath);
  console.log('[Electron] Preload exists:', fs.existsSync(preloadPath));
  console.log('[Electron] isPackaged:', app.isPackaged);
  console.log('[Electron] __dirname:', __dirname);

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
    show: false, // Don't show until ready
    backgroundColor: '#ffffff', // White background for splash
  });

  // Clear cache on startup to avoid permission issues
  if (!isDev && mainWindow && !mainWindow.isDestroyed()) {
    const session = mainWindow.webContents.session;
    
    // Clear cache on startup to avoid permission issues
    session.clearCache().catch(err => {
      console.warn('[Electron] Could not clear cache:', err.message);
    });
    
    console.log('[Electron] Cache cleared, using temp directory:', userCachePath);
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      // Always open DevTools for debugging (can be disabled in production later)
      if (mainWindow.webContents) {
        mainWindow.webContents.openDevTools();
      }
      console.log('[Electron] Window shown, DevTools opened');
    }
  });

  // Handle navigation errors - but don't retry automatically (prevents loops)
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    let retryCount = 0;
    const maxRetries = 2;
    
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.log('[Electron] Navigation failed:', errorCode, errorDescription, 'URL:', validatedURL);
      
      // Only retry if it's a connection error and we haven't retried too many times
      if (errorCode === -102 && retryCount < maxRetries && mainWindow && !mainWindow.isDestroyed()) {
        retryCount++;
        console.log(`[Electron] Retrying load (attempt ${retryCount}/${maxRetries})...`);
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL('http://localhost:3000');
          }
        }, 3000); // Wait longer before retry
      } else {
        console.error('[Electron] Navigation failed - not retrying (max retries reached or different error)');
      }
    });
  }

  // URL will be set after server starts
  let startUrl = 'http://localhost:3000';

  console.log('[Electron] isDev:', isDev);
  console.log('[Electron] __dirname:', __dirname);
  
  // Log all console messages from renderer to terminal
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      const levelStr = ['verbose', 'info', 'warning', 'error'][level] || 'unknown';
      console.log(`[Renderer ${levelStr}]:`, message);
    });

    // Catch JavaScript errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame) {
        console.error('[Electron] Page failed to load:', errorCode, errorDescription, validatedURL);
      }
    });

    mainWindow.webContents.on('render-process-gone', (event, details) => {
      console.error('[Electron] Render process crashed:', details.reason, details.exitCode);
    });

    mainWindow.webContents.on('unresponsive', () => {
      console.warn('[Electron] Page became unresponsive');
    });

    mainWindow.webContents.on('responsive', () => {
      console.log('[Electron] Page became responsive again');
    });
  }

  // Also log when page loads
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[Electron] Page finished loading');
      
      // Immediately check for JavaScript errors and try to execute a test script
      setTimeout(() => {
        if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) return;
        mainWindow.webContents.executeJavaScript(`
        (function() {
          var errorLog = [];
          var originalError = window.onerror;
          window.onerror = function(msg, url, line, col, error) {
            errorLog.push({
              type: 'error',
              message: msg,
              filename: url,
              lineno: line,
              colno: col,
              error: error ? error.toString() : 'unknown',
              stack: error ? error.stack : 'no stack'
            });
            console.error('[JS Error]', msg, url, line, col, error);
            if (originalError) originalError.apply(this, arguments);
          };
          
          window.addEventListener('unhandledrejection', function(e) {
            errorLog.push({
              type: 'unhandledrejection',
              reason: e.reason ? e.reason.toString() : 'unknown',
              stack: e.reason && e.reason.stack ? e.reason.stack : 'no stack'
            });
            console.error('[JS Unhandled Rejection]', e.reason);
          });
          
          // Try to load React manually to see if it works
          try {
            if (typeof window.__next_f !== 'undefined') {
              console.log('[JS] __next_f exists, trying to trigger hydration...');
              // Try to trigger Next.js hydration
              if (window.__next_f && Array.isArray(window.__next_f)) {
                console.log('[JS] __next_f is array, length:', window.__next_f.length);
              }
            }
          } catch (e) {
            errorLog.push({
              type: 'hydration_attempt',
              error: e.toString(),
              stack: e.stack
            });
          }
          
          return {
            errors: errorLog,
            hasNextF: typeof window.__next_f !== 'undefined',
            hasReact: typeof window.React !== 'undefined',
            hasNextData: typeof window.__NEXT_DATA__ !== 'undefined',
            documentReady: document.readyState,
            bodyExists: !!document.body,
            nextRootExists: !!document.getElementById('__next')
          };
        })();
      `).then(result => {
        console.log('[Electron] JavaScript status check:', JSON.stringify(result, null, 2));
        if (result.errors && result.errors.length > 0) {
          console.error('[Electron] ⚠ JavaScript errors detected:', JSON.stringify(result.errors, null, 2));
        }
        if (!result.hasReact && result.hasNextF) {
          console.warn('[Electron] ⚠ React not loaded but Next.js framework detected - scripts may have errors');
        }
      }).catch(err => {
        console.error('[Electron] Failed to check JavaScript status:', err.message);
      });
    }, 100);
    
    // Check for React/Next.js status with multiple checks
    const checkStatus = (delay) => {
      setTimeout(() => {
        if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) return;
        mainWindow.webContents.executeJavaScript(`
          (function() {
            var status = {
              hasNextF: typeof window.__next_f !== 'undefined',
              hasReact: typeof window.React !== 'undefined',
              hasNextData: typeof window.__NEXT_DATA__ !== 'undefined',
              scriptsLoaded: document.querySelectorAll('script[src*="_next"]').length,
              nextRoot: null,
              nextRootVisible: false,
              bodyContent: document.body ? document.body.innerHTML.length : 0,
              allScripts: Array.from(document.querySelectorAll('script')).map(s => s.src || 'inline').filter(Boolean)
            };
            var nextRoot = document.getElementById('__next');
            if (nextRoot) {
              status.nextRoot = 'exists';
              status.nextRootVisible = window.getComputedStyle(nextRoot).display !== 'none';
              status.nextRootContentLength = nextRoot.innerHTML.length;
            }
            return status;
          })();
        `).then(result => {
          console.log(`[Electron] React/Next.js status (${delay}ms):`, JSON.stringify(result, null, 2));
          if (result.scriptsLoaded === 0) {
            console.warn('[Electron] ⚠ No Next.js scripts found in DOM');
          }
          if (!result.hasNextF && delay < 5000) {
            console.warn('[Electron] ⚠ Next.js framework not detected yet, will check again...');
          }
        }).catch(err => {
          console.error('[Electron] Failed to check React status:', err.message);
        });
      }, delay);
    };
    
    // Check at multiple intervals
    checkStatus(500);
    checkStatus(1000);
    checkStatus(2000);
    checkStatus(3000);
    checkStatus(5000);
    });
  }

  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.on('dom-ready', () => {
      console.log('[Electron] DOM ready');
    });
  }
  
  // Load window after server is ready
  const loadWindow = (url) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.error('[Electron] Cannot load URL - window is destroyed');
      return;
    }
    console.log('[Electron] Loading URL:', url);
    mainWindow.loadURL(url).catch((error) => {
      console.error('[Electron] Failed to load URL:', error);
      // Retry after a short delay only if window still exists
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(url);
        }
      }, 2000);
    });
  };
  
  if (!isDev) {
    // Start Next.js server and then load - WAIT for server to be ACTUALLY ready
    console.log('[Electron] Starting Next.js server, then loading window...');
    startNextServer().then(async (url) => {
      console.log('[Electron] Server promise resolved, verifying server is actually ready...');
      
      // Verify server is actually responding before loading
      // Use the URL returned from startNextServer (may have different port)
      const checkServer = () => {
        return new Promise((resolve) => {
          const req = http.get(url, (res) => {
            console.log(`[Electron] ✅ Server is ACTUALLY responding! Status: ${res.statusCode}`);
            resolve(true);
          });
          req.on('error', (err) => {
            if (err.code === 'ECONNREFUSED') {
              console.log('[Electron] ⚠ Server not ready yet, will check again...');
              resolve(false);
            } else {
              console.error('[Electron] Error checking server:', err.message);
              resolve(false);
            }
          });
          req.setTimeout(2000, () => {
            req.destroy();
            resolve(false);
          });
        });
      };
      
      // Check server multiple times with delays
      let attempts = 0;
      const maxAttempts = 10;
      while (attempts < maxAttempts) {
        const isReady = await checkServer();
        if (isReady) {
          console.log('[Electron] ✅ Server confirmed ready, loading window...');
          if (mainWindow && !mainWindow.isDestroyed()) {
            loadWindow(url);
          }
          return;
        }
        attempts++;
        console.log(`[Electron] Waiting for server... (attempt ${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // If we get here, server never became ready, but try loading anyway
      console.warn('[Electron] ⚠ Server never confirmed ready, but loading window anyway...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        loadWindow(url);
      }
    }).catch((err) => {
      console.error('[Electron] Failed to start Next.js server:', err);
      // Don't retry automatically - this causes loops
      console.error('[Electron] ❌ Server failed to start - window will show error page');
    });
  } else {
    // In dev, just load (dev server should already be running)
    loadWindow(startUrl);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    isCreatingWindow = false; // Reset flag when window is closed
  });
  
  // Reset flag after a short delay to allow window to fully initialize
  setTimeout(() => {
    isCreatingWindow = false;
  }, 2000);
};

// Start Next.js production server inside Electron using programmatic API
// This approach allows API routes to work properly
const startNextServer = async () => {
  // Prevent multiple server starts
  if (isServerStarting) {
    console.log('[Electron] Server already starting, returning existing promise...');
    return Promise.resolve(`http://localhost:${PORT}`);
  }
  
  if (!isDev) {
    isServerStarting = true;
    
    try {
      // In packaged app (asar disabled), files are in resources/app
      // In development, files are in parent directory
      const appPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'app')
        : path.join(__dirname, '..');
      
      console.log('[Electron] Starting Next.js server programmatically...');
      console.log('[Electron] App path:', appPath);
      console.log('[Electron] isPackaged:', app.isPackaged);
      console.log('[Electron] process.resourcesPath:', process.resourcesPath);
      console.log('[Electron] __dirname:', __dirname);
      
      // Check if paths exist
      if (app.isPackaged) {
        console.log('[Electron] Checking packaged app structure...');
        console.log('[Electron] App path exists:', fs.existsSync(appPath));
        if (fs.existsSync(appPath)) {
          const files = fs.readdirSync(appPath).slice(0, 10);
          console.log('[Electron] Files in app path:', files);
        }
      }
      
      // Change to app directory to ensure Next.js finds config files
      const originalCwd = process.cwd();
      process.chdir(appPath);
      
      // Use Next.js programmatic API
      const next = require('next');
      
      nextApp = next({
        dev: false,
        dir: appPath,
      });
      
      console.log('[Electron] Preparing Next.js app...');
      await nextApp.prepare();
      console.log('[Electron] ✅ Next.js app prepared');
      
      const handle = nextApp.getRequestHandler();
      
      // Check if port is already in use
      const portInUse = await checkPortInUse(PORT);
      let actualPort = PORT;
      
      if (portInUse) {
        console.log(`[Electron] ⚠ Port ${PORT} is already in use, finding available port...`);
        const availablePort = await findAvailablePort(PORT);
        if (availablePort) {
          actualPort = availablePort;
          console.log(`[Electron] ✅ Found available port: ${actualPort}`);
        } else {
          console.error('[Electron] ❌ Could not find available port, trying to use existing server on port 3000');
          // If we can't find a port, try to use the existing server
          // Check if it's our own server by making a test request
          try {
            const testReq = http.get(`http://localhost:${PORT}`, (res) => {
              console.log(`[Electron] ✅ Existing server found on port ${PORT}, reusing it`);
              // Restore original working directory
              process.chdir(originalCwd);
              // Reset flag
              setTimeout(() => {
                isServerStarting = false;
              }, 1000);
              return `http://localhost:${PORT}`;
            });
            testReq.on('error', () => {
              throw new Error(`Port ${PORT} is in use by another application`);
            });
            testReq.setTimeout(2000, () => {
              testReq.destroy();
              throw new Error(`Port ${PORT} is in use but not responding`);
            });
            // Wait a bit for the test request
            await new Promise(resolve => setTimeout(resolve, 500));
            actualPort = PORT; // Use existing port
          } catch (error) {
            throw new Error(`Port ${PORT} is in use and not accessible: ${error.message}`);
          }
        }
      }
      
      // Create HTTP server
      httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
      });
      
      // Start server on the determined port
      await new Promise((resolve, reject) => {
        httpServer.listen(actualPort, (err) => {
          if (err) {
            console.error(`[Electron] ❌ Failed to start server on port ${actualPort}:`, err);
            reject(err);
            return;
          }
          console.log(`[Electron] ✅ Next.js server started on http://localhost:${actualPort}`);
          resolve();
        });
      });
      
      // Restore original working directory
      process.chdir(originalCwd);
      
      // Reset flag after successful start
      setTimeout(() => {
        isServerStarting = false;
      }, 1000);
      
      return `http://localhost:${actualPort}`;
      
    } catch (error) {
      console.error('[Electron] ❌ Error starting Next.js server:', error);
      isServerStarting = false;
      
      // Fallback: try spawning next start as before
      console.log('[Electron] Falling back to spawned process...');
      const appPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'app')
        : path.join(__dirname, '..');
      
      nextProcess = spawn('npm', ['run', 'start'], {
        cwd: appPath,
        shell: true,
        stdio: 'pipe',
        env: {
          ...process.env,
          PORT: PORT.toString(),
          NODE_ENV: 'production',
        },
      });
      
      // Wait for server to be ready
      return new Promise((resolve) => {
        let serverReady = false;
        
        const checkServer = () => {
          return new Promise((resolveCheck) => {
            const req = http.get(`http://localhost:${PORT}`, (res) => {
              resolveCheck(true);
            });
            req.on('error', () => resolveCheck(false));
            req.setTimeout(1000, () => {
              req.destroy();
              resolveCheck(false);
            });
          });
        };
        
        const waitForServer = async () => {
          for (let i = 0; i < 20; i++) {
            const isReady = await checkServer();
            if (isReady) {
              console.log('[Electron] ✅ Fallback server is ready');
              resolve(`http://localhost:${PORT}`);
              return;
            }
            await new Promise(r => setTimeout(r, 1000));
          }
          console.warn('[Electron] ⚠ Fallback server timeout, but returning URL anyway');
          resolve(`http://localhost:${PORT}`);
        };
        
        nextProcess.stdout.on('data', (data) => {
          const output = data.toString();
          if (output.includes('Ready') || output.includes('started server')) {
            if (!serverReady) {
              serverReady = true;
              waitForServer();
            }
          }
        });
        
        // Timeout fallback
        setTimeout(() => {
          if (!serverReady) {
            waitForServer();
          }
        }, 10000);
      });
    }
  }
  
  // In dev mode, server is already running
  return Promise.resolve(`http://localhost:${PORT}`);
};

// Start Next.js dev server in development
const startNextDevServer = () => {
  if (isDev) {
    nextProcess = spawn('npm', ['run', 'dev:next'], {
      shell: true,
      stdio: 'inherit',
    });

    nextProcess.on('error', (error) => {
      console.error('Failed to start Next.js dev server:', error);
    });
  }
};

// IPC Handlers
ipcMain.handle('ping', () => {
  return 'pong';
});

// Prevent multiple app.whenReady() calls
let appReadyCalled = false;

app.whenReady().then(() => {
  if (appReadyCalled) {
    console.log('[Electron] ⚠ app.whenReady() called multiple times, ignoring...');
    return;
  }
  appReadyCalled = true;
  
  console.log('[Electron] ✅ App ready, creating window...');
  
  if (isDev) {
    startNextDevServer();
    // Wait a bit for Next.js dev server to start
    setTimeout(() => {
      createWindow();
    }, 3000);
  } else {
    // In production, create window immediately
    // The window will start Next.js server and load when ready
    createWindow();
  }

  app.on('activate', () => {
    console.log('[Electron] activate event triggered');
    
    // Only create window if none exist AND not already creating
    if (isCreatingWindow) {
      console.log('[Electron] activate: window creation in progress, ignoring...');
      return;
    }
    
    const allWindows = BrowserWindow.getAllWindows();
    console.log(`[Electron] activate: found ${allWindows.length} windows`);
    
    if (allWindows.length === 0) {
      console.log('[Electron] activate: no windows, creating new one...');
      createWindow();
    } else {
      // Focus existing window instead of creating new one
      console.log('[Electron] activate: focusing existing window...');
      allWindows[0].focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Cleanup: close Next.js server
    if (httpServer) {
      console.log('[Electron] Closing HTTP server...');
      httpServer.close(() => {
        console.log('[Electron] ✅ HTTP server closed');
      });
    }
    if (nextProcess) {
      console.log('[Electron] Killing Next.js process...');
      nextProcess.kill();
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  // Cleanup: close Next.js server and process
  if (httpServer) {
    console.log('[Electron] Closing HTTP server (before-quit)...');
    httpServer.close();
  }
  if (nextProcess) {
    console.log('[Electron] Killing Next.js process (before-quit)...');
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


