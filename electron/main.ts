import { app, BrowserWindow, dialog } from 'electron'
import path from 'node:path'
import { initDb, closeDb, getDbPath } from './db/client'
import { registerIpcHandlers } from './ipc/register'
import { settingsRepo, periodTypeRulesRepo } from './db/repositories'
import { runScheduledBackupIfDue } from './backup'

// Populated by vite-plugin-electron during `npm run dev`.
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  const userDataDir = app.getPath('userData')

  let db
  try {
    db = initDb(userDataDir)
  } catch (error) {
    const dbPath = getDbPath(userDataDir)
    dialog.showErrorBox(
      'BunkMate Pro — database problem',
      `The local database at\n${dbPath}\nfailed its integrity check and could not be opened safely.\n\n` +
        `To recover: close this dialog, then replace that file with a backup copy ` +
        `(Settings → Backup & restore, or the backup folder if auto-backup was on) and relaunch.\n\n` +
        `Details: ${error instanceof Error ? error.message : String(error)}`,
    )
    app.exit(1)
    return
  }

  settingsRepo.ensureSettingsRow(db)
  periodTypeRulesRepo.ensureDefaultPeriodTypeRules(db)
  registerIpcHandlers(db)
  runScheduledBackupIfDue(db)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') app.quit()
})
