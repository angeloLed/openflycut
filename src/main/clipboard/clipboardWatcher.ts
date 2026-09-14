import { clipboard } from 'electron'
import { CLIPBOARD_POLL_INTERVAL_MS } from '../constants'
import { addOrMergeToTop } from '../store/historyStore'
import { getSettings } from '../store/settingsStore'

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
    addOrMergeToTop(text, getSettings().maxHistorySize)
    onChange()
  }, CLIPBOARD_POLL_INTERVAL_MS)
}

export function stopClipboardWatcher(): void {
  if (timer) clearInterval(timer)
  timer = null
}
