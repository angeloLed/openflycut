import { useState } from 'react'
import type { KeyboardEvent } from 'react'

interface Props {
  label: string
  value: string
  error?: string
  onChange: (accelerator: string) => void
}

const MODIFIER_KEYS = new Set(['Control', 'Meta', 'Alt', 'Shift'])

// Electron accelerator names differ from DOM key names for these.
const KEY_NAMES: Record<string, string> = {
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ' ': 'Space'
}

function toAccelerator(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const key = KEY_NAMES[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key)
  parts.push(key)
  return parts.join('+')
}

export default function HotkeyRecorder({ label, value, error, onChange }: Props) {
  const [recording, setRecording] = useState(false)

  return (
    <label className="field-row">
      <span>{label}</span>
      <input
        className="hotkey-input"
        readOnly
        value={recording ? 'Press a key combination…' : value}
        onFocus={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={(e) => {
          e.preventDefault()
          const accelerator = toAccelerator(e)
          if (accelerator) {
            onChange(accelerator)
            setRecording(false)
            e.currentTarget.blur()
          }
        }}
      />
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}
