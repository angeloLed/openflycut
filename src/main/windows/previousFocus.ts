/**
 * Restores OS focus to whatever window was active before the popup stole it,
 * so the user can paste immediately without clicking back into their app.
 * Windows-only: Electron has no cross-platform API for controlling focus of
 * windows it doesn't own, so this shells out to user32.dll via koffi (a
 * prebuilt-binary FFI library — no native compilation/Visual Studio needed).
 */
import koffi from 'koffi'

let getForegroundWindow: (() => bigint) | null = null
let setForegroundWindow: ((hwnd: bigint) => boolean) | null = null

if (process.platform === 'win32') {
  try {
    const user32 = koffi.load('user32.dll')
    getForegroundWindow = user32.func('GetForegroundWindow', 'void *', [])
    setForegroundWindow = user32.func('SetForegroundWindow', 'bool', ['void *'])
  } catch {
    // If the native module fails to load for any reason, focus restore is
    // simply skipped — the popup still works, just without this UX polish.
  }
}

let capturedHandle: bigint | null = null

export function capturePreviousFocus(): void {
  if (!getForegroundWindow) return
  capturedHandle = getForegroundWindow()
}

export function restorePreviousFocus(): void {
  if (!setForegroundWindow || capturedHandle === null) return
  setForegroundWindow(capturedHandle)
  capturedHandle = null
}
