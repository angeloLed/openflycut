import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { AppSettings, Bucket, ClipItem, PopupView } from '@shared/types'

type Result<T = void> = { ok: true; value: T } | { ok: false; error: string }

const api = {
  view: {
    get: (): Promise<PopupView> => ipcRenderer.invoke(IPC.ViewGet),
    onChanged: (callback: () => void): (() => void) => {
      const listener = (): void => callback()
      ipcRenderer.on(IPC.HistoryChanged, listener)
      return () => ipcRenderer.removeListener(IPC.HistoryChanged, listener)
    }
  },
  history: {
    selectItem: (bucketId: string, id: string): Promise<void> =>
      ipcRenderer.invoke(IPC.HistorySelectItem, bucketId, id),
    pinItem: (bucketId: string, id: string): Promise<ClipItem[]> =>
      ipcRenderer.invoke(IPC.HistoryPinItem, bucketId, id),
    deleteItem: (bucketId: string, id: string): Promise<ClipItem[]> =>
      ipcRenderer.invoke(IPC.HistoryDeleteItem, bucketId, id),
    clearAll: (bucketId: string): Promise<ClipItem[]> => ipcRenderer.invoke(IPC.HistoryClearAll, bucketId),
    getSize: (): Promise<number> => ipcRenderer.invoke(IPC.HistoryGetSize),
    updateItemText: (bucketId: string, id: string, text: string): Promise<Result<ClipItem[]>> =>
      ipcRenderer.invoke(IPC.HistoryUpdateItemText, bucketId, id, text)
  },
  buckets: {
    setCurrent: (id: string): Promise<Result<Bucket>> => ipcRenderer.invoke(IPC.BucketsSetCurrent, id),
    getItems: (id: string): Promise<ClipItem[]> => ipcRenderer.invoke(IPC.BucketsGetItems, id),
    create: (name: string): Promise<Result<Bucket>> => ipcRenderer.invoke(IPC.BucketsCreate, name),
    rename: (id: string, name: string): Promise<Result<Bucket>> => ipcRenderer.invoke(IPC.BucketsRename, id, name),
    delete: (id: string): Promise<Result> => ipcRenderer.invoke(IPC.BucketsDelete, id)
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
    ): Promise<{ settings: AppSettings; shortcutErrors: Partial<Record<keyof Pick<AppSettings, 'hotkey' | 'bucketPrevHotkey' | 'bucketNextHotkey'>, string>> }> =>
      ipcRenderer.invoke(IPC.SettingsUpdate, patch)
  },
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.AppGetVersion),
    getPlatform: (): Promise<NodeJS.Platform> => ipcRenderer.invoke(IPC.AppGetPlatform)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
