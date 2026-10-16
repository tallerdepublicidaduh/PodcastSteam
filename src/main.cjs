const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const { loadFeed } = require('./feed.cjs');

let window, tray, quitting = false;
const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIElEQVQ4T2Nk+P//PwMlgImBQjBqwKgBowaMGjBqAAANPwMdfGf0WQAAAABJRU5ErkJggg==');

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { window?.show(); window?.focus(); });
  app.whenReady().then(() => {
    ipcMain.handle('podcast:load', (event, url) => {
      if (event.sender !== window.webContents || typeof url !== 'string' || url.length > 4096) throw new Error('Solicitud no válida.');
      return loadFeed(url);
    });
    window = new BrowserWindow({
      width: 1320, height: 850, minWidth: 780, minHeight: 600,
      backgroundColor: '#171d25', title: 'PodcastSteam', autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false }
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.loadFile(path.join(__dirname, 'index.html'));
    tray = new Tray(icon);
    tray.setToolTip('PodcastSteam · Reproducción en segundo plano');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Abrir PodcastSteam', click: () => window.show() },
      { label: 'Reproducir / Pausar', click: () => window.webContents.send('player:toggle') },
      { type: 'separator' },
      { label: 'Salir', click: () => app.quit() }
    ]));
    tray.on('click', () => window.show());
    // Keep audio alive when closed only if the OS exposes an accessible tray.
    window.on('close', event => {
      if (!quitting && process.platform !== 'linux') { event.preventDefault(); window.hide(); }
    });
  });
  app.on('before-quit', () => { quitting = true; });
  app.on('activate', () => window?.show());
  app.on('window-all-closed', () => app.quit());
}
