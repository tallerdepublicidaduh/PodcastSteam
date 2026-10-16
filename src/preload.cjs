const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('podcast', {
  load: url => ipcRenderer.invoke('podcast:load', url),
  onToggle: callback => ipcRenderer.on('player:toggle', () => callback())
});
