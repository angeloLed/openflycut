import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { AppSettings, ClipItem } from '@shared/types'

const api = {
  history: {
    getAll: (): Promise<ClipItem[]> => ipcRenderer.invoke(IPC.HistoryGetAll),
    selectItem: (id: string): Promise<void> => ipcRenderer.invoke(IPC.HistorySelectItem, id),
    pinItem: (id: string): Promise<ClipItem[]> => ipcRenderer.invoke(IPC.HistoryPinItem, id),
    deleteItem: (id: string): Promise<ClipItem[]> => ipcRenderer.invoke(IPC.HistoryDeleteItem, id),
    clearAll: (): Promise<ClipItem[]> => ipcRenderer.invoke(IPC.HistoryClearAll),
    onChanged: (callback: () => void): (() => void) => {
      const listener = (): void => callback()
      ipcRenderer.on(IPC.HistoryChanged, listener)
      return () => ipcRenderer.removeListener(IPC.HistoryChanged, listener)
    }
  },
  popup: {
    hide: (): void => ipcRenderer.send(IPC.PopupHide),
    onConfirmHoldSelection: (callback: () => void): (() => void) => {
      const listener = (): void => callback()
      ipcRenderer.on(IPC.PopupConfirmHoldSelection, listener)
      return () => ipcRenderer.removeListener(IPC.PopupConfirmHoldSelection, listener)
    }
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SettingsGet),
    update: (
      patch: Partial<AppSettings>
    ): Promise<{ settings: AppSettings; hotkeyError?: string }> =>
      ipcRenderer.invoke(IPC.SettingsUpdate, patch)
  },
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.AppGetVersion),
    getPlatform: (): Promise<NodeJS.Platform> => ipcRenderer.invoke(IPC.AppGetPlatform)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
