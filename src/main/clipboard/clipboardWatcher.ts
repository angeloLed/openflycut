import { clipboard } from 'electron'
import { CLIPBOARD_POLL_INTERVAL_MS } from '../constants'
import { addOrMergeToTop } from '../store/historyStore'
import { getSettings } from '../store/settingsStore'
import { getClipboardOwnerExePath } from './sourceApp'
import { resolveSourceApp } from './sourceAppIcon'

let lastSeenText = ''
let timer: NodeJS.Timeout | null = null

/** Call before writing to the clipboard ourselves so the next poll tick doesn't treat it as a new external copy. */
export function noteOwnWrite(text: string): void {
  lastSeenText = text
}

export function startClipboardWatcher(onChange: () => void): void {
  lastSeenText = clipboard.readText()
  timer = setInterval(() => {
    const text = clipboard.readText()
    if (!text || text === lastSeenText) return
    lastSeenText = text
    // Resolve the owning window right away, before the async icon lookup,
    // so it's as close as possible to the moment of the actual copy.
    let exePath: string | null = null
    try {
      exePath = getClipboardOwnerExePath()
    } catch (err) {
      console.error('[clipboardWatcher] getClipboardOwnerExePath threw:', err)
    }
    handleNewClip(text, exePath, onChange).catch((err) => {
      console.error('[clipboardWatcher] failed to record new clip:', err)
    })
  }, CLIPBOARD_POLL_INTERVAL_MS)
}

async function handleNewClip(text: string, exePath: string | null, onChange: () => void): Promise<void> {
  const sourceApp = exePath ? await resolveSourceApp(exePath) : undefined
  addOrMergeToTop(text, getSettings().maxHistorySize, sourceApp)
  onChange()
}

export function stopClipboardWatcher(): void {
  if (timer) clearInterval(timer)
  timer = null
}
