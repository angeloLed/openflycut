import Store from 'electron-store'
import { AppSettings, DEFAULT_SETTINGS } from '@shared/types'

const store = new Store<AppSettings>({
  name: 'settings',
  defaults: DEFAULT_SETTINGS
})

export function getSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...store.store }
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  store.set({ ...store.store, ...patch })
  return getSettings()
}
