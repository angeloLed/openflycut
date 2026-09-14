import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import MaxSizeField from './MaxSizeField'
import HotkeyRecorder from './HotkeyRecorder'
import ToggleRow from './ToggleRow'

export default function SettingsApp() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [hotkeyError, setHotkeyError] = useState<string | undefined>()
  const [version, setVersion] = useState('')
  const [isLinux, setIsLinux] = useState(false)
  const [isWindows, setIsWindows] = useState(false)

  useEffect(() => {
    window.api.settings.get().then(setSettings)
    window.api.app.getVersion().then(setVersion)
    window.api.app.getPlatform().then((platform) => {
      setIsLinux(platform === 'linux')
      setIsWindows(platform === 'win32')
    })
  }, [])

  const update = async (patch: Partial<AppSettings>): Promise<void> => {
    const result = await window.api.settings.update(patch)
    setSettings(result.settings)
    setHotkeyError(result.hotkeyError)
  }

  return (
    <div className="settings-app">
      <h1>OpenFlyCut Preferences</h1>
      <MaxSizeField
        value={settings.maxHistorySize}
        onChange={(n) => update({ maxHistorySize: n })}
      />
      <HotkeyRecorder
        value={settings.hotkey}
        error={hotkeyError}
        onChange={(hotkey) => update({ hotkey })}
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
      <footer>OpenFlyCut {version}</footer>
    </div>
  )
}
