import { app } from 'electron'

/**
 * app.setLoginItemSettings is unsupported on Linux; the settings UI disables
 * this toggle there. Whether the app actually shows its popup on launch is
 * controlled entirely by our own `startMinimized` setting (checked in
 * main/index.ts), not by anything passed here — Electron's `openAsHidden`
 * was macOS-only and has since been removed from the API entirely.
 */
export function applyLaunchAtLogin(enabled: boolean): void {
  if (process.platform === 'linux') return
  app.setLoginItemSettings({ openAtLogin: enabled })
}
