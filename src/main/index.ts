import { app, BrowserWindow } from 'electron'
import { createTray } from './tray'
import { getPopupWindow, togglePopupWindow } from './windows/popupWindow'
import { startClipboardWatcher, stopClipboardWatcher } from './clipboard/clipboardWatcher'
import { registerIpcHandlers } from './ipc/ipcHandlers'
import { unregisterAll } from './shortcuts/globalShortcuts'
import { bindAllShortcuts } from './shortcuts/bindings'
import { getSettings } from './store/settingsStore'
import { flushHistorySync } from './store/historyStore'
import { applyLaunchAtLogin } from './autoLaunch'
import { IPC } from '@shared/ipc-channels'
import { setQuitting } from './appState'

const hasLock = app.requestSingleInstanceLock()

if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    togglePopupWindow()
  })

  app.whenReady().then(() => {
    const settings = getSettings()

    registerIpcHandlers()

    createTray(() => {
      getPopupWindow().webContents.send(IPC.HistoryChanged)
    })

    startClipboardWatcher(() => {
      const win = getPopupWindow()
      if (win.isVisible()) {
        win.webContents.send(IPC.HistoryChanged)
      }
    }).catch((err) => {
      console.error('[main] failed to start clipboard watcher:', err)
    })

    bindAllShortcuts(settings)
    applyLaunchAtLogin(settings.launchAtLogin)

    if (!settings.startMinimized) {
      togglePopupWindow()
    }
  })

  app.on('window-all-closed', () => {
    // Tray app: keep running even with no windows open.
  })

  app.on('before-quit', () => {
    setQuitting(true)
  })

  app.on('will-quit', () => {
    unregisterAll()
    stopClipboardWatcher()
    flushHistorySync()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      togglePopupWindow()
    }
  })
}
