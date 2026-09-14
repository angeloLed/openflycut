import { clipboard } from 'electron'
import { CLIPBOARD_POLL_INTERVAL_MS } from '../constants'
import { addOrMergeToTop, setItemSourceApp } from '../store/historyStore'
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

    // Record the clip immediately — the item must never wait on the
    // best-effort icon lookup below, which can be slow or fail for some apps.
    const items = addOrMergeToTop(text, getSettings().maxHistorySize)
    const newItemId = items[0]?.id
    onChange()

    let exePath: string | null = null
    try {
      exePath = getClipboardOwnerExePath()
    } catch (err) {
      console.error('[clipboardWatcher] getClipboardOwnerExePath threw:', err)
    }
    if (!exePath || !newItemId) return

    resolveSourceApp(exePath)
      .then((sourceApp) => {
        if (!sourceApp) return
        setItemSourceApp(newItemId, sourceApp)
        onChange()
      })
      .catch((err) => {
        console.error('[clipboardWatcher] failed to resolve source app icon:', err)
      })
  }, CLIPBOARD_POLL_INTERVAL_MS)
}

export function stopClipboardWatcher(): void {
  if (timer) clearInterval(timer)
  timer = null
}
