/**
 * Resolves the executable path of whichever app currently owns the clipboard
 * content, so the history list can show its icon. Windows-only: Electron has
 * no cross-platform "who owns the clipboard" API, so this walks
 * GetClipboardOwner -> GetWindowThreadProcessId -> OpenProcess ->
 * QueryFullProcessImageNameW via koffi (prebuilt binary, no native compile).
 */
import koffi from 'koffi'

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
const MAX_PATH_CHARS = 260

let GetClipboardOwner: (() => bigint) | null = null
let GetWindowThreadProcessId: ((hwnd: bigint, pid: number[]) => number) | null = null
let OpenProcess: ((access: number, inherit: boolean, pid: number) => bigint) | null = null
let QueryFullProcessImageNameW:
  | ((hProcess: bigint, flags: number, buffer: Buffer, size: number[]) => boolean)
  | null = null
let CloseHandle: ((handle: bigint) => boolean) | null = null

if (process.platform === 'win32') {
  try {
    const user32 = koffi.load('user32.dll')
    const kernel32 = koffi.load('kernel32.dll')

    GetClipboardOwner = user32.func('GetClipboardOwner', 'void *', [])
    GetWindowThreadProcessId = user32.func('GetWindowThreadProcessId', 'uint32_t', [
      'void *',
      koffi.out(koffi.pointer('uint32_t'))
    ])
    OpenProcess = kernel32.func('OpenProcess', 'void *', ['uint32_t', 'bool', 'uint32_t'])
    QueryFullProcessImageNameW = kernel32.func('QueryFullProcessImageNameW', 'bool', [
      'void *',
      'uint32_t',
      'wchar_t *',
      koffi.inout(koffi.pointer('uint32_t'))
    ])
    CloseHandle = kernel32.func('CloseHandle', 'bool', ['void *'])
  } catch {
    // Native module failed to load — source-app icons are simply skipped.
  }
}

export function getClipboardOwnerExePath(): string | null {
  if (!GetClipboardOwner || !GetWindowThreadProcessId || !OpenProcess || !QueryFullProcessImageNameW || !CloseHandle) {
    return null
  }

  const hwnd = GetClipboardOwner()
  if (!hwnd) return null

  const pid = [0]
  GetWindowThreadProcessId(hwnd, pid)
  if (!pid[0]) return null

  const hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid[0])
  if (!hProcess) return null

  try {
    const buffer = Buffer.alloc(MAX_PATH_CHARS * 2)
    const size = [MAX_PATH_CHARS]
    const ok = QueryFullProcessImageNameW(hProcess, 0, buffer, size)
    if (!ok) return null
    return buffer.toString('utf16le', 0, size[0] * 2)
  } finally {
    CloseHandle(hProcess)
  }
}
