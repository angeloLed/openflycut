import { useEffect, useRef } from 'react'
import SearchBox from './SearchBox'
import ClipList from './ClipList'
import { usePopupController } from './usePopupController'

export default function PopupApp() {
  const {
    items,
    query,
    setQuery,
    selectedIndex,
    moveSelection,
    selectCurrent,
    selectItem,
    togglePin,
    deleteItem,
    registerItemRef
  } = usePopupController()

  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        moveSelection(1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        moveSelection(-1)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        selectCurrent()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        window.api.popup.hide()
      } else if (
        document.activeElement !== searchInputRef.current &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        // The list is focused by default; typing jumps into search, like
        // Start Menu / Quick Open style lists.
        e.preventDefault()
        setQuery(query + e.key)
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <div className="popup-app">
      <SearchBox ref={searchInputRef} value={query} onChange={setQuery} />
      <ClipList
        items={items}
        selectedIndex={selectedIndex}
        onSelect={selectItem}
        onTogglePin={togglePin}
        onDelete={deleteItem}
        registerItemRef={registerItemRef}
      />
    </div>
  )
}
