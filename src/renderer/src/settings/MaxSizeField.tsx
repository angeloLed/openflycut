interface Props {
  value: number
  onChange: (value: number) => void
}

export default function MaxSizeField({ value, onChange }: Props) {
  return (
    <label className="field-row">
      <span>Max history size</span>
      <input
        type="number"
        min={1}
        max={999}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n) && n > 0) onChange(n)
        }}
      />
    </label>
  )
}
