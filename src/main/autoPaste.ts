/**
 * Optional "auto-paste on select": after copying a history item to the
 * clipboard and restoring focus to the previously active window, simulates
 * Ctrl+V there so the user doesn't have to press it themselves. Windows-only,
 * via user32's keybd_event (koffi, prebuilt binary — no native compile).
 * Both keys are always released, even on error, so a failure here can never
 * leave Ctrl stuck down on the user's real keyboard.
 */
import koffi from 'koffi'

const VK_CONTROL = 0x11
const VK_V = 0x56
const KEYEVENTF_KEYUP = 0x0002

let keybdEvent: ((vk: number, scan: number, flags: number, extra: number) => void) | null = null

if (process.platform === 'win32') {
  try {
    const user32 = koffi.load('user32.dll')
    keybdEvent = user32.func(
      'void keybd_event(uint8_t bVk, uint8_t bScan, uint32_t dwFlags, uintptr_t dwExtraInfo)'
    )
  } catch {
    // Native module failed to load — auto-paste is simply unavailable.
  }
}

export function isAutoPasteSupported(): boolean {
  return keybdEvent !== null
}

export function sendPasteKeystroke(): void {
  if (!keybdEvent) return
  try {
    keybdEvent(VK_CONTROL, 0, 0, 0)
    keybdEvent(VK_V, 0, 0, 0)
  } finally {
    keybdEvent(VK_V, 0, KEYEVENTF_KEYUP, 0)
    keybdEvent(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)
  }
}
