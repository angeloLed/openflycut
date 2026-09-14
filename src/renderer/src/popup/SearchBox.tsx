import { forwardRef } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
}

const SearchBox = forwardRef<HTMLInputElement, Props>(function SearchBox({ value, onChange }, ref) {
  return (
    <input
      ref={ref}
      className="search-box"
      type="text"
      placeholder="Search clipboard history…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
})

export default SearchBox
