import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  // Get screen dimensions
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Calculate window size (80% of screen, but with min/max constraints)
  const windowWidth = Math.min(1400, Math.max(1000, Math.floor(screenWidth * 0.8)));
  const windowHeight = Math.min(900, Math.max(700, Math.floor(screenHeight * 0.85)));

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 800,
    minHeight: 600,
    maxWidth: screenWidth,
    maxHeight: screenHeight,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      zoomFactor: 1.0,
    },
    backgroundColor: '#1a1a2e',
    show: false,
    center: true,
  });

  // Load the UI
  const WEB_URL = process.env.WEB_URL || 'http://localhost:5173';

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(WEB_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the desktop app HTML
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// This method will be called when Electron has finished initialization
app.on('ready', createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('platform', () => {
  return process.platform;
});
