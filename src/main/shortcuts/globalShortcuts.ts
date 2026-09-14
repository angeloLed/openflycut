import { globalShortcut } from 'electron'

let currentAccelerator: string | null = null

/** Returns false if the accelerator is already taken (by the OS or another app) — globalShortcut.register fails silently. */
export function registerShortcut(accelerator: string, callback: () => void): boolean {
  if (currentAccelerator) {
    globalShortcut.unregister(currentAccelerator)
  }
  const ok = globalShortcut.register(accelerator, callback)
  if (ok) {
    currentAccelerator = accelerator
  } else if (currentAccelerator) {
    globalShortcut.register(currentAccelerator, callback)
  }
  return ok
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll()
  currentAccelerator = null
}
