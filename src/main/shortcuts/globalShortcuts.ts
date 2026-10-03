import { globalShortcut } from 'electron'

export type ShortcutName = 'toggle' | 'bucketPrev' | 'bucketNext'

interface Registration {
  accelerator: string
  callback: () => void
}

const registrations = new Map<ShortcutName, Registration>()

/**
 * Returns false if the accelerator is already taken (by the OS or another app)
 * — globalShortcut.register fails silently — in which case the previous
 * binding for this name is restored so the user never loses a working shortcut.
 */
export function registerShortcut(name: ShortcutName, accelerator: string, callback: () => void): boolean {
  const previous = registrations.get(name)
  if (previous) globalShortcut.unregister(previous.accelerator)

  const ok = globalShortcut.register(accelerator, callback)
  if (ok) {
    registrations.set(name, { accelerator, callback })
  } else if (previous) {
    globalShortcut.register(previous.accelerator, previous.callback)
  }
  return ok
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll()
  registrations.clear()
}
