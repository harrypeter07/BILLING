const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let nextProcess;

const isDev = process.env.NODE_ENV === 'development';

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
    },
    icon: path.join(__dirname, '../public/favicon.ico'),
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../out/index.html')}`;

  console.log('Loading URL:', startUrl);
  mainWindow.loadURL(startUrl).catch((error) => {
    console.error('Failed to load URL:', error);
    if (!isDev) {
      // Fallback: try loading from different path
      const altPath = `file://${path.join(process.resourcesPath, 'out/index.html')}`;
      console.log('Trying alternative path:', altPath);
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

