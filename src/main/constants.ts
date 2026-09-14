import { join } from 'path'
import { app } from 'electron'

export const CLIPBOARD_POLL_INTERVAL_MS = 500

export function getIconPath(fileName: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, fileName)
    : join(__dirname, '../../resources', fileName)
}
