const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Ping test
  ping: () => ipcRenderer.invoke('ping'),
  
  // Platform info
  platform: process.platform,
  
  // Version info
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  
  // Future: File operations
  // saveFile: (data, filename) => ipcRenderer.invoke('save-file', data, filename),
  // openFile: () => ipcRenderer.invoke('open-file'),
  
  // Future: Print operations
  // printInvoice: (html) => ipcRenderer.invoke('print-invoice', html),
  
  // Future: Export operations
  // exportToExcel: (data) => ipcRenderer.invoke('export-excel', data),
});

// Log that preload script has loaded
console.log('[Preload] Electron preload script loaded');


