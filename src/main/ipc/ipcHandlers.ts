import { ipcMain, clipboard, app, shell } from 'electron'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { IPC } from '@shared/ipc-channels'
import type { AppSettings } from '@shared/types'
import * as historyStore from '../store/historyStore'
import * as settingsStore from '../store/settingsStore'
import { noteOwnWrite } from '../clipboard/clipboardWatcher'
import { hidePopupWindow, notifyPopupChanged } from '../windows/popupWindow'
import { applyLaunchAtLogin } from '../autoLaunch'
import { sendPasteKeystroke } from '../autoPaste'
import { bindShortcut, findDuplicateShortcut, ShortcutField, SHORTCUT_FIELDS } from '../shortcuts/bindings'

/** Gives the OS time to finish switching focus to the previous window before we simulate Ctrl+V there. */
const AUTO_PASTE_DELAY_MS = 120

type ShortcutErrors = Partial<Record<ShortcutField, string>>

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.ViewGet, () => historyStore.getView())

  ipcMain.handle(IPC.HistorySelectItem, (_event, bucketId: string, id: string) => {
    const item = historyStore.getItems(bucketId).find((i) => i.id === id)
    if (!item) return
    noteOwnWrite(item.text)
    // Not awaited: the popup should close instantly. The write completes long
    // before the auto-paste keystroke below, which waits AUTO_PASTE_DELAY_MS.
    clipboard.writeText(item.text).catch((err) => console.error('[ipc] clipboard write failed:', err))
    historyStore.addOrMergeToTop(bucketId, item.text, settingsStore.getSettings().maxHistorySize)
    hidePopupWindow()

    if (settingsStore.getSettings().autoPasteOnSelect) {
      setTimeout(() => sendPasteKeystroke(), AUTO_PASTE_DELAY_MS)
    }
  })

  ipcMain.handle(IPC.HistoryPinItem, (_event, bucketId: string, id: string) => historyStore.togglePin(bucketId, id))
  ipcMain.handle(IPC.HistoryDeleteItem, (_event, bucketId: string, id: string) =>
    historyStore.removeItem(bucketId, id)
  )
  ipcMain.handle(IPC.HistoryClearAll, (_event, bucketId: string) => historyStore.clearAll(bucketId))
  ipcMain.handle(IPC.HistoryGetSize, () => historyStore.getStorageBytes())
  ipcMain.handle(IPC.HistoryRevealFile, () => {
    const file = historyStore.getHistoryFilePath()
    if (existsSync(file)) shell.showItemInFolder(file)
    else shell.openPath(dirname(file))
  })
  ipcMain.handle(IPC.HistoryUpdateItemText, (_event, bucketId: string, id: string, text: string) => {
    const result = historyStore.updateItemText(bucketId, id, text)
    notifyPopupChanged()
    return result
  })

  ipcMain.on(IPC.PopupHide, () => hidePopupWindow())

  ipcMain.handle(IPC.BucketsSetCurrent, (_event, id: string) => {
    const result = historyStore.setCurrentBucket(id)
    notifyPopupChanged()
    return result
  })
  ipcMain.handle(IPC.BucketsGetItems, (_event, id: string) => historyStore.getItems(id))
  ipcMain.handle(IPC.BucketsCreate, (_event, name: string) => {
    const result = historyStore.createBucket(name)
    notifyPopupChanged()
    return result
  })
  ipcMain.handle(IPC.BucketsRename, (_event, id: string, name: string) => {
    const result = historyStore.renameBucket(id, name)
    notifyPopupChanged()
    return result
  })
  ipcMain.handle(IPC.BucketsDelete, (_event, id: string) => {
    const result = historyStore.deleteBucket(id)
    notifyPopupChanged()
    return result
  })

  ipcMain.handle(IPC.SettingsGet, () => settingsStore.getSettings())

  ipcMain.handle(IPC.SettingsUpdate, (_event, patch: Partial<AppSettings>) => {
    const previous = settingsStore.getSettings()
    const candidate = { ...previous, ...patch }
    const shortcutErrors: ShortcutErrors = {}

    const duplicate = findDuplicateShortcut(candidate)
    if (duplicate) {
      shortcutErrors[duplicate] = `This shortcut is already used by another action`
    }

    const accepted: Partial<AppSettings> = {}
    for (const field of Object.keys(SHORTCUT_FIELDS) as ShortcutField[]) {
      if (!(field in patch) || patch[field] === previous[field]) continue
      if (shortcutErrors[field]) continue
      if (bindShortcut(field, patch[field] as string)) {
        accepted[field] = patch[field]
      } else {
        shortcutErrors[field] = `"${patch[field]}" is already in use`
      }
    }

    const settings = settingsStore.updateSettings({ ...patch, ...accepted, ...revertRejected(patch, accepted, previous) })

    if (typeof patch.launchAtLogin === 'boolean') {
      applyLaunchAtLogin(patch.launchAtLogin)
    }

    return { settings, shortcutErrors }
  })

  ipcMain.handle(IPC.AppGetVersion, () => app.getVersion())
  ipcMain.handle(IPC.AppGetPlatform, () => process.platform)
}

/** Shortcut fields the user tried to change but that failed validation keep their previous value. */
function revertRejected(
  patch: Partial<AppSettings>,
  accepted: Partial<AppSettings>,
  previous: AppSettings
): Partial<AppSettings> {
  const reverted: Partial<AppSettings> = {}
  for (const field of Object.keys(SHORTCUT_FIELDS) as ShortcutField[]) {
    if (field in patch && !(field in accepted)) reverted[field] = previous[field]
  }
  return reverted
}
