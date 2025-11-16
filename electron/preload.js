const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Ping test
    ping: () => ipcRenderer.invoke('ping'),
    
    // Generic invoke for IPC calls
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    
    // Platform info
    platform: process.platform,
    
    // Version info
    versions: {
      node: process.versions.node,
      chrome: process.versions.chrome,
      electron: process.versions.electron,
    },
  });
  
  console.log('[Preload] ✅ Electron preload script loaded & electronAPI exposed successfully');
} catch (error) {
  console.error('[Preload] ❌ Error exposing electronAPI:', error);
}


