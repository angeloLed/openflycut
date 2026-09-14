import { app } from 'electron'
import { basename, extname } from 'node:path'
import type { SourceApp } from '@shared/types'

const cache = new Map<string, SourceApp>()

export async function resolveSourceApp(exePath: string): Promise<SourceApp | undefined> {
  const cached = cache.get(exePath)
  if (cached) return cached

  const name = basename(exePath, extname(exePath))
  const sourceApp: SourceApp = { name }

  try {
    const icon = await app.getFileIcon(exePath, { size: 'small' })
    if (!icon.isEmpty()) {
      sourceApp.iconDataUrl = icon.toDataURL()
    }
  } catch {
    // No icon available — the item just shows without one.
  }

  cache.set(exePath, sourceApp)
  return sourceApp
}
