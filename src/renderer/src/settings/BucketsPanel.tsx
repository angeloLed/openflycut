import { useEffect, useState } from 'react'
import type { Bucket, ClipItem } from '@shared/types'

export default function BucketsPanel() {
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [currentId, setCurrentId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [items, setItems] = useState<ClipItem[]>([])
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [error, setError] = useState('')

  const refresh = async (): Promise<void> => {
    const view = await window.api.view.get()
    setBuckets(view.buckets)
    setCurrentId(view.currentBucketId)
    setSelectedId((prev) => (view.buckets.some((b) => b.id === prev) ? prev : view.currentBucketId))
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (!selectedId) return
    window.api.buckets.getItems(selectedId).then(setItems)
  }, [selectedId, buckets])

  const fail = (message: string): void => setError(message)

  const handleCreate = async (): Promise<void> => {
    const result = await window.api.buckets.create(newName)
    if (!result.ok) return fail(result.error)
    setNewName('')
    setError('')
    await refresh()
    setSelectedId(result.value.id)
  }

  const handleSetCurrent = async (id: string): Promise<void> => {
    const result = await window.api.buckets.setCurrent(id)
    if (!result.ok) return fail(result.error)
    setError('')
    setCurrentId(id)
  }

  const commitRename = async (id: string): Promise<void> => {
    const result = await window.api.buckets.rename(id, renameValue)
    if (!result.ok) return fail(result.error)
    setRenamingId(null)
    setError('')
    await refresh()
  }

  const handleDelete = async (id: string): Promise<void> => {
    const bucket = buckets.find((b) => b.id === id)
    if (!bucket) return
    if (!window.confirm(`Delete bucket "${bucket.name}" and all its entries?`)) return
    const result = await window.api.buckets.delete(id)
    if (!result.ok) return fail(result.error)
    setError('')
    await refresh()
  }

  const commitItemText = async (item: ClipItem, text: string): Promise<void> => {
    if (text === item.text) return
    const result = await window.api.history.updateItemText(selectedId, item.id, text)
    if (!result.ok) return fail(result.error)
    setError('')
    setItems(result.value)
  }

  const handleDeleteItem = async (id: string): Promise<void> => {
    setItems(await window.api.history.deleteItem(selectedId, id))
  }

  return (
    <div className="buckets-panel">
      <section className="bucket-list">
        <h2>Buckets</h2>
        <ul>
          {buckets.map((b) => (
            <li key={b.id} className={b.id === selectedId ? 'bucket-row selected' : 'bucket-row'}>
              {renamingId === b.id ? (
                <input
                  className="bucket-rename"
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(b.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(b.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                />
              ) : (
                <button className="bucket-select" onClick={() => setSelectedId(b.id)}>
                  {b.name}
                  {b.id === currentId && <span className="badge-current">current</span>}
                </button>
              )}
              <div className="bucket-actions">
                {b.id !== currentId && (
                  <button title="Make current" onClick={() => handleSetCurrent(b.id)}>
                    ★
                  </button>
                )}
                <button
                  title="Rename"
                  onClick={() => {
                    setRenamingId(b.id)
                    setRenameValue(b.name)
                  }}
                >
                  ✎
                </button>
                <button title="Delete" disabled={buckets.length <= 1} onClick={() => handleDelete(b.id)}>
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="bucket-create">
          <input
            placeholder="New bucket name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
          />
          <button onClick={handleCreate}>Add</button>
        </div>
        {error && <p className="field-error">{error}</p>}
      </section>

      <section className="bucket-items">
        <h2>Entries{buckets.find((b) => b.id === selectedId) ? ` — ${buckets.find((b) => b.id === selectedId)?.name}` : ''}</h2>
        {items.length === 0 && <p className="empty-state">No entries in this bucket</p>}
        <ul>
          {items.map((item) => (
            <li key={item.id} className="item-row">
              <textarea
                className="item-text"
                defaultValue={item.text}
                rows={2}
                onBlur={(e) => commitItemText(item, e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    e.currentTarget.blur()
                  }
                }}
              />
              <button className="item-delete" title="Delete entry" onClick={() => handleDeleteItem(item.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
