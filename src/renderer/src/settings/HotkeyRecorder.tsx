import { useState } from 'react'
import type { KeyboardEvent } from 'react'

interface Props {
  value: string
  error?: string
  onChange: (accelerator: string) => void
}

const MODIFIER_KEYS = new Set(['Control', 'Meta', 'Alt', 'Shift'])

function toAccelerator(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
  parts.push(key)
  return parts.join('+')
}

export default function HotkeyRecorder({ value, error, onChange }: Props) {
  const [recording, setRecording] = useState(false)

  return (
    <label className="field-row">
      <span>Global hotkey</span>
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
