import type { ClipItem } from '@shared/types'

interface Props {
  item: ClipItem
  active: boolean
  onSelect: () => void
  onTogglePin: () => void
  onDelete: () => void
}

export default function ClipListItem({
  item,
  active,
  onSelect,
  onTogglePin,
  onDelete
}: Props) {
  return (
    <li className={`clip-item${active ? ' active' : ''}`} onClick={onSelect}>
      <span className="clip-text">{item.text.replace(/\s+/g, ' ').slice(0, 200)}</span>
      <span className="clip-actions">
        <button
          className={`pin-btn${item.pinned ? ' pinned' : ''}`}
          title={item.pinned ? 'Unpin' : 'Pin'}
          onClick={(e) => {
            e.stopPropagation()
            onTogglePin()
          }}
        >
          ★
        </button>
        <button
          className="delete-btn"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          ✕
        </button>
      </span>
    </li>
  )
}
