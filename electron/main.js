const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const fs = require('fs');
const { createServer } = require('http');
const { parse } = require('url');

let mainWindow;
let nextProcess;
let httpServer;

const isDev = process.env.NODE_ENV === 'development';
const PORT = 3000;

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

  // Handle navigation errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.log('[Electron] Navigation failed:', errorCode, errorDescription, 'URL:', validatedURL);
    // Retry loading the main page
    setTimeout(() => {
      mainWindow.loadURL('http://localhost:3000');
    }, 1000);
  });

  const startUrl = 'http://localhost:3000';

  console.log('[Electron] Loading URL:', startUrl);
  console.log('[Electron] isDev:', isDev);
  console.log('[Electron] __dirname:', __dirname);
  
  // Log all console messages from renderer to terminal
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

  // Also log when page loads
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Electron] Page finished loading');
    // Check for JavaScript errors and React status
    setTimeout(() => {
      mainWindow.webContents.executeJavaScript(`
        (function() {
          var status = {
            hasNextF: typeof window.__next_f !== 'undefined',
            hasReact: typeof window.React !== 'undefined',
            nextRoot: null,
            nextRootVisible: false,
            errors: []
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
        console.log('[Electron] React/Next.js status:', JSON.stringify(result, null, 2));
        if (!result.hasNextF && !result.hasReact) {
          console.warn('[Electron] ⚠ React/Next.js not detected - JavaScript may not be loading');
        }
      }).catch(err => {
        console.error('[Electron] Failed to check React status:', err.message);
      });
    }, 1000);
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('[Electron] DOM ready');
  });
  
  // Wait a bit for the server to be ready, then load
  const loadWindow = () => {
    mainWindow.loadURL(startUrl).catch((error) => {
      console.error('[Electron] Failed to load URL:', error);
      // Retry after a short delay
      setTimeout(() => {
        mainWindow.loadURL(startUrl);
      }, 1000);
    });
  };
  
  if (!isDev) {
    // Wait for server to be ready
    setTimeout(loadWindow, 500);
  } else {
    loadWindow();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Start local HTTP server to serve static files in production
const startStaticServer = () => {
  if (!isDev) {
    const outDir = path.join(__dirname, '../out');
    
    httpServer = createServer((req, res) => {
      const parsedUrl = parse(req.url || '/', true);
      let filePath = path.join(outDir, parsedUrl.pathname || '/');
      
      // Default to index.html for directories
      if (filePath.endsWith('/') || !path.extname(filePath)) {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        } else if (!fs.existsSync(filePath)) {
          // Try adding .html extension
          const htmlPath = filePath + '.html';
          if (fs.existsSync(htmlPath)) {
            filePath = htmlPath;
          } else {
            // Fallback to index.html
            filePath = path.join(outDir, 'index.html');
          }
        }
      }
      
      // Security: prevent directory traversal
      if (!filePath.startsWith(outDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      
      // Determine content type
      const ext = path.extname(filePath).toLowerCase();
      const contentTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.ico': 'image/x-icon',
      };
      
      const contentType = contentTypes[ext] || 'application/octet-stream';
      
      // Read and serve file
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end('Internal Server Error');
          return;
        }
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });
    
    httpServer.listen(PORT, 'localhost', () => {
      console.log(`[Electron] Static server started on http://localhost:${PORT}`);
    });
    
    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[Electron] Port ${PORT} already in use, assuming server is running`);
      } else {
        console.error('[Electron] Failed to start static server:', err);
      }
    });
  }
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
    // Start static server first, then create window
    startStaticServer();
    // Wait a bit for server to start
    setTimeout(() => {
      createWindow();
    }, 500);
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
    if (httpServer) {
      httpServer.close();
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  if (nextProcess) {
    nextProcess.kill();
  }
  if (httpServer) {
    httpServer.close();
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

