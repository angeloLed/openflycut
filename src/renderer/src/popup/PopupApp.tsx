import { useEffect } from 'react'
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
    deleteItem
  } = usePopupController()

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
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <div className="popup-app">
      <SearchBox value={query} onChange={setQuery} />
      <ClipList
        items={items}
        selectedIndex={selectedIndex}
        onSelect={selectItem}
        onTogglePin={togglePin}
        onDelete={deleteItem}
      />
    </div>
  )
}
