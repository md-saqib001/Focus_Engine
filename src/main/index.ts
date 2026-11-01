import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getDatabase, closeDatabase } from './database/db'
import { registerSessionHandlers } from './ipc/sessionHandlers'
import { registerBlockingHandlers } from './ipc/blockingHandlers'
import { registerAppBlockingHandlers } from './ipc/appBlockingHandlers'
import { registerTelemetryHandlers } from './ipc/telemetryHandlers'
import { registerCVHandlers } from './ipc/cvHandlers'
import { registerBufferHandlers } from './ipc/bufferHandlers'
import { registerAnalyticsHandlers } from './ipc/analyticsHandlers'
import { restoreHostsSync } from './blocking/hostsFileManager'
import { settingsRepository } from './database/settingsRepository'
import { registerMLHandlers, weeklyRetraining } from './ml/weeklyRetraining'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Initialize database (creates file + schema if first run)
  getDatabase()

  // Seed default calibration values if this is first launch
  settingsRepository.seedDefaultsIfNeeded()

  // Run weekly ML retraining check
  weeklyRetraining.checkAndTriggerRetrain().catch((err) => {
    console.error('[WeeklyRetraining] Startup check failed:', err)
  })

  // Register all IPC handlers
  registerSessionHandlers()
  registerBlockingHandlers()
  registerAppBlockingHandlers()
  registerTelemetryHandlers()
  registerCVHandlers()
  registerBufferHandlers()
  registerAnalyticsHandlers()
  registerMLHandlers()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up database connection and restore hosts blocking on quit
app.on('before-quit', () => {
  try {
    restoreHostsSync()
  } catch (error) {
    console.error('Failed to restore hosts on shutdown:', error)
  }
  closeDatabase()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
