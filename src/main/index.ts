import { app, BrowserWindow } from 'electron'
import { createTray } from './tray'
import { getPopupWindow, togglePopupWindow } from './windows/popupWindow'
import { startClipboardWatcher } from './clipboard/clipboardWatcher'
import { registerIpcHandlers } from './ipc/ipcHandlers'
import { registerShortcut, unregisterAll } from './shortcuts/globalShortcuts'
import { getSettings } from './store/settingsStore'
import { applyLaunchAtLogin } from './autoLaunch'
import { IPC } from '@shared/ipc-channels'
import { stopClipboardWatcher } from './clipboard/clipboardWatcher'
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
    })

    registerShortcut(settings.hotkey, () => togglePopupWindow())
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
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      togglePopupWindow()
    }
  })
}
