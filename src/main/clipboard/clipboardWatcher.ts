import { clipboard } from 'electron'
import { CLIPBOARD_POLL_INTERVAL_MS } from '../constants'
import { addOrMergeToTop, getCurrentBucketId, setItemSourceApp } from '../store/historyStore'
import { getSettings } from '../store/settingsStore'
import { getClipboardOwnerExePath } from './sourceApp'
import { resolveSourceApp } from './sourceAppIcon'

let lastSeenText = ''
let timer: NodeJS.Timeout | null = null

/** Call before writing to the clipboard ourselves so the next poll tick doesn't treat it as a new external copy. */
export function noteOwnWrite(text: string): void {
  lastSeenText = text
}

export async function startClipboardWatcher(onChange: () => void): Promise<void> {
  lastSeenText = await clipboard.readText()
  timer = setInterval(() => {
    pollOnce(onChange).catch((err) => {
      console.error('[clipboardWatcher] poll tick failed:', err)
    })
  }, CLIPBOARD_POLL_INTERVAL_MS)
}

async function pollOnce(onChange: () => void): Promise<void> {
  const text = await clipboard.readText()
  if (!text || text === lastSeenText) return
  lastSeenText = text

  // New copies always land in the bucket currently on screen. Captured here so
  // a bucket switch during the async icon lookup can't misfile the icon.
  const bucketId = getCurrentBucketId()
  // Record the clip immediately — the item must never wait on the
  // best-effort icon lookup below, which can be slow or fail for some apps.
  const items = addOrMergeToTop(bucketId, text, getSettings().maxHistorySize)
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
      setItemSourceApp(bucketId, newItemId, sourceApp)
      onChange()
    })
    .catch((err) => {
      console.error('[clipboardWatcher] failed to resolve source app icon:', err)
    })
}

export function stopClipboardWatcher(): void {
  if (timer) clearInterval(timer)
  timer = null
}
