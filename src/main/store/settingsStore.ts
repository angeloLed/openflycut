import Store from 'electron-store'
import { AppSettings, DEFAULT_SETTINGS } from '@shared/types'

const store = new Store<AppSettings>({
  name: 'settings',
  defaults: DEFAULT_SETTINGS
})

// Read once and kept in memory: electron-store re-reads the file on every get(),
// and settings are consulted on every clipboard capture.
let cache: AppSettings | null = null

function load(): AppSettings {
  if (!cache) cache = { ...DEFAULT_SETTINGS, ...store.store }
  return cache
}

export function getSettings(): AppSettings {
  return { ...load() }
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  cache = { ...load(), ...patch }
  store.set(cache)
  return getSettings()
}
