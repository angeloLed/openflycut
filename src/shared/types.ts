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

export interface Bucket {
  id: string
  name: string
}

export interface PopupView {
  buckets: Bucket[]
  currentBucketId: string
  items: ClipItem[]
}

export interface AppSettings {
  maxHistorySize: number
  hotkey: string
  bucketPrevHotkey: string
  bucketNextHotkey: string
  launchAtLogin: boolean
  startMinimized: boolean
  holdToSelect: boolean
  autoPasteOnSelect: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  maxHistorySize: 99,
  hotkey: 'CommandOrControl+Shift+V',
  bucketPrevHotkey: 'CommandOrControl+Alt+Left',
  bucketNextHotkey: 'CommandOrControl+Alt+Right',
  launchAtLogin: false,
  startMinimized: true,
  holdToSelect: false,
  autoPasteOnSelect: false
}

export const DEFAULT_BUCKET_NAME = 'default'
export const MAX_BUCKET_NAME_LENGTH = 40
