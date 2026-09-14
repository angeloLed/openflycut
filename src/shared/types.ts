export interface SourceApp {
  name: string
  iconDataUrl?: string
}

export interface ClipItem {
  id: string
  text: string
  createdAt: number
  pinned: boolean
  sourceApp?: SourceApp
}

export interface AppSettings {
  maxHistorySize: number
  hotkey: string
  launchAtLogin: boolean
  startMinimized: boolean
  holdToSelect: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  maxHistorySize: 99,
  hotkey: 'CommandOrControl+Shift+V',
  launchAtLogin: false,
  startMinimized: true,
  holdToSelect: false
}
