export interface ClipItem {
  id: string
  text: string
  createdAt: number
  pinned: boolean
}

export interface AppSettings {
  maxHistorySize: number
  hotkey: string
  launchAtLogin: boolean
  startMinimized: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  maxHistorySize: 99,
  hotkey: 'CommandOrControl+Shift+V',
  launchAtLogin: false,
  startMinimized: true
}
