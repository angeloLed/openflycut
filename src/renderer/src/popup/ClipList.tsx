import type { ClipItem } from '@shared/types'
import ClipListItem from './ClipListItem'

interface Props {
  items: ClipItem[]
  selectedIndex: number
  onSelect: (id: string) => void
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
}

export default function ClipList({
  items,
  selectedIndex,
  onSelect,
  onTogglePin,
  onDelete
}: Props) {
  if (items.length === 0) {
    return <div className="empty-state">No clipboard history yet</div>
  }

  return (
    <ul className="clip-list">
      {items.map((item, index) => (
        <ClipListItem
          key={item.id}
          item={item}
          active={index === selectedIndex}
          onSelect={() => onSelect(item.id)}
          onTogglePin={() => onTogglePin(item.id)}
          onDelete={() => onDelete(item.id)}
        />
      ))}
    </ul>
  )
}
