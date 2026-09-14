import { app } from 'electron'
import { basename, extname } from 'node:path'
import type { SourceApp } from '@shared/types'

const cache = new Map<string, SourceApp>()
const ICON_LOOKUP_TIMEOUT_MS = 3000

export async function resolveSourceApp(exePath: string): Promise<SourceApp | undefined> {
  const cached = cache.get(exePath)
  if (cached) return cached

  const name = basename(exePath, extname(exePath))
  const sourceApp: SourceApp = { name }

  try {
    const icon = await Promise.race([
      app.getFileIcon(exePath, { size: 'small' }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('icon lookup timed out')), ICON_LOOKUP_TIMEOUT_MS)
      )
    ])
    if (!icon.isEmpty()) {
      sourceApp.iconDataUrl = icon.toDataURL()
    }
  } catch {
    // No icon available (or it took too long) — the item just shows without one.
  }

  cache.set(exePath, sourceApp)
  return sourceApp
}
