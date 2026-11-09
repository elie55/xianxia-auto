const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nineHeavens', {
  isElectron: true,
  quit: () => ipcRenderer.send('app:quit'),
  toggleFullscreen: () => ipcRenderer.invoke('app:toggle-fullscreen'),
});
