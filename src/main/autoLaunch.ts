import { app } from 'electron'

/** app.setLoginItemSettings is unsupported on Linux; the settings UI disables this toggle there. */
export function applyLaunchAtLogin(enabled: boolean): void {
  if (process.platform === 'linux') return
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
    args: enabled ? ['--hidden'] : []
  })
}
