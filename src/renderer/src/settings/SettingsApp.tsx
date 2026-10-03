import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import MaxSizeField from './MaxSizeField'
import HotkeyRecorder from './HotkeyRecorder'
import ToggleRow from './ToggleRow'
import BucketsPanel from './BucketsPanel'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

type Tab = 'general' | 'buckets'
type ShortcutErrors = Partial<Record<'hotkey' | 'bucketPrevHotkey' | 'bucketNextHotkey', string>>

export default function SettingsApp() {
  const [tab, setTab] = useState<Tab>('general')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [shortcutErrors, setShortcutErrors] = useState<ShortcutErrors>({})
  const [version, setVersion] = useState('')
  const [historyBytes, setHistoryBytes] = useState<number | null>(null)
  const [isLinux, setIsLinux] = useState(false)
  const [isWindows, setIsWindows] = useState(false)

  useEffect(() => {
    window.api.settings.get().then(setSettings)
    window.api.history.getSize().then(setHistoryBytes)
    window.api.app.getVersion().then(setVersion)
    window.api.app.getPlatform().then((platform) => {
      setIsLinux(platform === 'linux')
      setIsWindows(platform === 'win32')
    })
  }, [])

  const update = async (patch: Partial<AppSettings>): Promise<void> => {
    const result = await window.api.settings.update(patch)
    setSettings(result.settings)
    setShortcutErrors(result.shortcutErrors)
    window.api.history.getSize().then(setHistoryBytes)
  }

  return (
    <div className="settings-app">
      <h1>OpenFlyCut Preferences</h1>

      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'general'} className={tab === 'general' ? 'tab active' : 'tab'} onClick={() => setTab('general')}>
          General
        </button>
        <button role="tab" aria-selected={tab === 'buckets'} className={tab === 'buckets' ? 'tab active' : 'tab'} onClick={() => setTab('buckets')}>
          Buckets
        </button>
      </nav>

      {tab === 'general' && (
        <div className="tab-panel">
          <MaxSizeField
            value={settings.maxHistorySize}
            onChange={(n) => update({ maxHistorySize: n })}
          />
          <HotkeyRecorder
            label="Show history hotkey"
            value={settings.hotkey}
            error={shortcutErrors.hotkey}
            onChange={(hotkey) => update({ hotkey })}
          />
          <HotkeyRecorder
            label="Previous bucket"
            value={settings.bucketPrevHotkey}
            error={shortcutErrors.bucketPrevHotkey}
            onChange={(bucketPrevHotkey) => update({ bucketPrevHotkey })}
          />
          <HotkeyRecorder
            label="Next bucket"
            value={settings.bucketNextHotkey}
            error={shortcutErrors.bucketNextHotkey}
            onChange={(bucketNextHotkey) => update({ bucketNextHotkey })}
          />
          <ToggleRow
            label="Launch at login"
            checked={settings.launchAtLogin}
            disabled={isLinux}
            onChange={(launchAtLogin) => update({ launchAtLogin })}
          />
          <ToggleRow
            label="Start minimized to tray"
            checked={settings.startMinimized}
            onChange={(startMinimized) => update({ startMinimized })}
          />
          <ToggleRow
            label="Hold hotkey to browse, release to select"
            checked={settings.holdToSelect}
            disabled={!isWindows}
            onChange={(holdToSelect) => update({ holdToSelect })}
          />
          <ToggleRow
            label="Automatically paste after selecting an item"
            checked={settings.autoPasteOnSelect}
            disabled={!isWindows}
            onChange={(autoPasteOnSelect) => update({ autoPasteOnSelect })}
          />
          <p className="storage-info">
            History database (history.json):{' '}
            <strong>{historyBytes === null ? '…' : formatBytes(historyBytes)}</strong>
            <button className="link-button" onClick={() => window.api.history.revealFile()}>
              Open file location
            </button>
          </p>
          <footer>OpenFlyCut {version}</footer>
        </div>
      )}

      {tab === 'buckets' && <BucketsPanel />}
    </div>
  )
}
