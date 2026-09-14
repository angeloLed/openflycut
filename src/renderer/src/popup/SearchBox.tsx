import { useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
}

export default function SearchBox({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <input
      ref={inputRef}
      className="search-box"
      type="text"
      placeholder="Search clipboard history…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
