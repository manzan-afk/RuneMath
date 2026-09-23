// Desktop wrapper (Electron) so Rune Math can be installed like a normal app.
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 740,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: '#191b36',
    autoHideMenuBar: true,
    title: 'Rune Math',
    webPreferences: { contextIsolation: true },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
