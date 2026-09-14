import { ipcMain, clipboard, app } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { AppSettings } from '@shared/types'
import * as historyStore from '../store/historyStore'
import * as settingsStore from '../store/settingsStore'
import { noteOwnWrite } from '../clipboard/clipboardWatcher'
import { hidePopupWindow } from '../windows/popupWindow'
import { registerShortcut } from '../shortcuts/globalShortcuts'
import { handleHotkeyPress } from '../shortcuts/hotkeyHandler'
import { applyLaunchAtLogin } from '../autoLaunch'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.HistoryGetAll, () => historyStore.getAll())

  ipcMain.handle(IPC.HistorySelectItem, (_event, id: string) => {
    const item = historyStore.getAll().find((i) => i.id === id)
    if (!item) return
    noteOwnWrite(item.text)
    clipboard.writeText(item.text)
    historyStore.addOrMergeToTop(item.text, settingsStore.getSettings().maxHistorySize)
    hidePopupWindow()
  })

  ipcMain.handle(IPC.HistoryPinItem, (_event, id: string) => historyStore.togglePin(id))
  ipcMain.handle(IPC.HistoryDeleteItem, (_event, id: string) => historyStore.removeItem(id))
  ipcMain.handle(IPC.HistoryClearAll, () => historyStore.clearAll())

  ipcMain.on(IPC.PopupHide, () => hidePopupWindow())

  ipcMain.handle(IPC.SettingsGet, () => settingsStore.getSettings())

  ipcMain.handle(IPC.SettingsUpdate, (_event, patch: Partial<AppSettings>) => {
    const previousHotkey = settingsStore.getSettings().hotkey
    const settings = settingsStore.updateSettings(patch)
    let hotkeyError: string | undefined

    if (patch.hotkey && patch.hotkey !== previousHotkey) {
      const ok = registerShortcut(settings.hotkey, handleHotkeyPress)
      if (!ok) {
        hotkeyError = `Hotkey "${settings.hotkey}" is already in use`
        settingsStore.updateSettings({ hotkey: previousHotkey })
      }
    }

    if (typeof patch.launchAtLogin === 'boolean') {
      applyLaunchAtLogin(patch.launchAtLogin)
    }

    return { settings: settingsStore.getSettings(), hotkeyError }
  })

  ipcMain.handle(IPC.AppGetVersion, () => app.getVersion())
  ipcMain.handle(IPC.AppGetPlatform, () => process.platform)
}
