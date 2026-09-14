/**
 * "Hold to browse" support: Electron's globalShortcut only fires on keydown,
 * with no keyup/release event — there's no built-in way to know when the
 * user lets go of the hotkey. This polls the modifier keys' live state via
 * user32.dll's GetAsyncKeyState (koffi, prebuilt binary, no native compile)
 * so we can detect "all modifiers released" and confirm the highlighted item.
 * Windows-only.
 */
import koffi from 'koffi'

const POLL_INTERVAL_MS = 50

const VK_SHIFT = 0x10
const VK_CONTROL = 0x11
const VK_MENU = 0x12
const VK_LWIN = 0x5b

const MODIFIER_VIRTUAL_KEYS: Record<string, number> = {
  shift: VK_SHIFT,
  control: VK_CONTROL,
  ctrl: VK_CONTROL,
  commandorcontrol: VK_CONTROL,
  cmdorctrl: VK_CONTROL,
  alt: VK_MENU,
  option: VK_MENU,
  altgr: VK_MENU,
  super: VK_LWIN,
  command: VK_LWIN,
  cmd: VK_LWIN,
  meta: VK_LWIN
}

let GetAsyncKeyState: ((vKey: number) => number) | null = null

if (process.platform === 'win32') {
  try {
    const user32 = koffi.load('user32.dll')
    GetAsyncKeyState = user32.func('GetAsyncKeyState', 'int16_t', ['int32_t'])
  } catch {
    // Native module failed to load — hold-to-select is simply unavailable.
  }
}

/** Extracts the Windows virtual-key codes for the modifier parts of an Electron accelerator (e.g. "CommandOrControl+Shift+V"). */
export function parseModifierVirtualKeys(accelerator: string): number[] {
  const vKeys = new Set<number>()
  for (const part of accelerator.split('+')) {
    const vk = MODIFIER_VIRTUAL_KEYS[part.trim().toLowerCase()]
    if (vk) vKeys.add(vk)
  }
  return [...vKeys]
}

export function isHoldToSelectSupported(): boolean {
  return GetAsyncKeyState !== null
}

function isKeyDown(vKey: number): boolean {
  if (!GetAsyncKeyState) return false
  return (GetAsyncKeyState(vKey) & 0x8000) !== 0
}

let pollTimer: NodeJS.Timeout | null = null

/** Starts polling; calls onRelease exactly once, the moment any of the given modifier keys is no longer held. */
export function watchForModifierRelease(vKeys: number[], onRelease: () => void): void {
  stopWatchingForModifierRelease()
  if (!GetAsyncKeyState || vKeys.length === 0) return

  pollTimer = setInterval(() => {
    if (vKeys.some((vk) => !isKeyDown(vk))) {
      stopWatchingForModifierRelease()
      onRelease()
    }
  }, POLL_INTERVAL_MS)
}

export function stopWatchingForModifierRelease(): void {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}
