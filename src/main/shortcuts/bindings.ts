import { AppSettings } from '@shared/types'
import { registerShortcut, ShortcutName } from './globalShortcuts'
import { handleBucketCycle, handleHotkeyPress } from './hotkeyHandler'

export type ShortcutField = 'hotkey' | 'bucketPrevHotkey' | 'bucketNextHotkey'

export const SHORTCUT_FIELDS: Record<ShortcutField, ShortcutName> = {
  hotkey: 'toggle',
  bucketPrevHotkey: 'bucketPrev',
  bucketNextHotkey: 'bucketNext'
}

const CALLBACKS: Record<ShortcutName, () => void> = {
  toggle: handleHotkeyPress,
  bucketPrev: () => handleBucketCycle(-1),
  bucketNext: () => handleBucketCycle(1)
}

export function bindShortcut(field: ShortcutField, accelerator: string): boolean {
  const name = SHORTCUT_FIELDS[field]
  return registerShortcut(name, accelerator, CALLBACKS[name])
}

export function bindAllShortcuts(settings: AppSettings): void {
  for (const field of Object.keys(SHORTCUT_FIELDS) as ShortcutField[]) {
    bindShortcut(field, settings[field])
  }
}

/** Returns a human-readable error if two shortcut fields would share the same accelerator. */
export function findDuplicateShortcut(settings: AppSettings): ShortcutField | null {
  const seen = new Map<string, ShortcutField>()
  for (const field of Object.keys(SHORTCUT_FIELDS) as ShortcutField[]) {
    const key = settings[field].toLowerCase()
    if (seen.has(key)) return field
    seen.set(key, field)
  }
  return null
}
