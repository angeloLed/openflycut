import { IPC } from '@shared/ipc-channels'
import { getSettings } from '../store/settingsStore'
import { cycleBucket } from '../store/historyStore'
import { getPopupWindow, togglePopupWindow } from '../windows/popupWindow'
import { parseModifierVirtualKeys, watchForModifierRelease } from './holdToSelect'

/**
 * Fires on every hotkey keydown. Always reads settings fresh so a hotkey
 * rebind or a holdToSelect toggle from Preferences takes effect immediately,
 * without needing to re-register a new callback closure.
 */
export function handleHotkeyPress(): void {
  const settings = getSettings()
  const opened = togglePopupWindow()
  if (!opened || !settings.holdToSelect) return

  const vKeys = parseModifierVirtualKeys(settings.hotkey)
  watchForModifierRelease(vKeys, () => {
    const win = getPopupWindow()
    if (win.isVisible()) {
      win.webContents.send(IPC.PopupConfirmHoldSelection)
    }
  })
}

/**
 * Switches the current bucket. If the popup is already open it just refreshes
 * in place; if it's closed, opening it is what lets the user see the switch.
 */
export function handleBucketCycle(delta: 1 | -1): void {
  cycleBucket(delta)
  const win = getPopupWindow()
  if (win.isVisible()) {
    win.webContents.send(IPC.HistoryChanged)
  } else {
    togglePopupWindow()
  }
}
