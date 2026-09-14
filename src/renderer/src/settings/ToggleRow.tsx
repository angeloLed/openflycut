interface Props {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

export default function ToggleRow({ label, checked, disabled, onChange }: Props) {
  return (
    <label className={`toggle-row${disabled ? ' disabled' : ''}`}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}
