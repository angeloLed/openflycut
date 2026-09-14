import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { isQuitting } from '../appState'
import { capturePreviousFocus, restorePreviousFocus } from './previousFocus'
import { IPC } from '@shared/ipc-channels'

const WINDOW_WIDTH = 360
const WINDOW_HEIGHT = 420

let popupWindow: BrowserWindow | null = null

function createPopupWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.on('blur', () => {
    if (!app.isPackaged && win.webContents.isDevToolsOpened()) return
    win.hide()
  })

  win.on('close', (event) => {
    if (isQuitting()) return
    event.preventDefault()
    win.hide()
  })

  return win
}

function positionNearCursor(win: BrowserWindow): void {
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = display.workArea

  const x = Math.min(Math.max(cursor.x, areaX), areaX + areaWidth - WINDOW_WIDTH)
  const y = Math.min(Math.max(cursor.y, areaY), areaY + areaHeight - WINDOW_HEIGHT)

  win.setPosition(Math.round(x), Math.round(y))
}

export function getPopupWindow(): BrowserWindow {
  if (!popupWindow || popupWindow.isDestroyed()) {
    popupWindow = createPopupWindow()
  }
  return popupWindow
}

export function togglePopupWindow(): void {
  const win = getPopupWindow()
  if (win.isVisible()) {
    hidePopupWindow()
    return
  }
  capturePreviousFocus()
  positionNearCursor(win)
  win.show()
  win.focus()
  // The window is a singleton that's only shown/hidden, never reloaded, so
  // its React app doesn't remount on reopen — tell it to refetch explicitly,
  // otherwise it keeps showing whatever was current the first time it opened.
  win.webContents.send(IPC.HistoryChanged)
}

/** Hides the popup and hands focus back to whatever the user had active before it opened. */
export function hidePopupWindow(): void {
  if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible()) {
    popupWindow.hide()
    restorePreviousFocus()
  }
}
