import { app, Menu, Tray } from 'electron'
import { getIconPath } from './constants'
import { togglePopupWindow } from './windows/popupWindow'
import { openSettingsWindow } from './windows/settingsWindow'
import { clearAll } from './store/historyStore'

let tray: Tray | null = null

export function createTray(onHistoryChanged: () => void): Tray {
  tray = new Tray(getIconPath('icon.png'))
  tray.setToolTip('OpenFlyCut')

  const menu = Menu.buildFromTemplate([
    { label: 'Show History', click: () => togglePopupWindow() },
    { label: 'Preferences…', click: () => openSettingsWindow() },
    { type: 'separator' },
    {
      label: 'Clear History',
      click: () => {
        clearAll()
        onHistoryChanged()
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])
  tray.setContextMenu(menu)

  if (process.platform !== 'darwin') {
    tray.on('click', () => togglePopupWindow())
  }

  return tray
}
