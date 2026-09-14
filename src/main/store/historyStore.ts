import { randomUUID } from 'node:crypto'
import Store from 'electron-store'
import { ClipItem } from '@shared/types'

interface HistorySchema {
  items: ClipItem[]
}

const store = new Store<HistorySchema>({
  name: 'history',
  defaults: { items: [] }
})

export function getAll(): ClipItem[] {
  return store.get('items')
}

function save(items: ClipItem[]): ClipItem[] {
  store.set('items', items)
  return items
}

export function addOrMergeToTop(text: string, maxHistorySize: number): ClipItem[] {
  const items = getAll()
  const existingIndex = items.findIndex((i) => i.text === text)
  let entry: ClipItem
  let rest: ClipItem[]
  if (existingIndex >= 0) {
    entry = items[existingIndex]
    rest = items.filter((_, i) => i !== existingIndex)
  } else {
    entry = { id: randomUUID(), text, createdAt: Date.now(), pinned: false }
    rest = items
  }
  const merged = [entry, ...rest]
  return save(trim(merged, maxHistorySize))
}

function trim(items: ClipItem[], maxHistorySize: number): ClipItem[] {
  const pinned = items.filter((i) => i.pinned)
  const unpinned = items.filter((i) => !i.pinned)
  const keepUnpinned = unpinned.slice(0, Math.max(0, maxHistorySize - pinned.length))
  const keepIds = new Set([...pinned, ...keepUnpinned].map((i) => i.id))
  return items.filter((i) => keepIds.has(i.id))
}

export function togglePin(id: string): ClipItem[] {
  const items = getAll().map((i) => (i.id === id ? { ...i, pinned: !i.pinned } : i))
  return save(items)
}

export function removeItem(id: string): ClipItem[] {
  return save(getAll().filter((i) => i.id !== id))
}

export function clearAll(): ClipItem[] {
  return save(getAll().filter((i) => i.pinned))
}
