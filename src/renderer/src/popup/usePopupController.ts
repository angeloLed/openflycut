import { useEffect, useMemo, useRef, useState } from 'react'
import type { Bucket, ClipItem } from '@shared/types'

export function usePopupController() {
  const [items, setItems] = useState<ClipItem[]>([])
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [bucketId, setBucketId] = useState('')
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const itemRefs = useRef<Map<number, HTMLLIElement>>(new Map())
  const bucketIdRef = useRef('')

  const registerItemRef = (index: number, el: HTMLLIElement | null): void => {
    if (el) itemRefs.current.set(index, el)
    else itemRefs.current.delete(index)
  }

  const focusItem = (index: number): void => {
    itemRefs.current.get(index)?.focus()
  }

  // One round trip fetches bucket list, current bucket and its items together.
  const load = async (): Promise<void> => {
    const view = await window.api.view.get()
    if (view.currentBucketId !== bucketIdRef.current) setQuery('')
    bucketIdRef.current = view.currentBucketId
    setBuckets(view.buckets)
    setBucketId(view.currentBucketId)
    setItems(view.items)
  }

  useEffect(() => {
    load()
    return window.api.view.onChanged(load)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => i.text.toLowerCase().includes(q))
  }, [items, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Every time the list is (re)loaded — on mount, on reopen, on a bucket switch
  // or when a background clip arrives — jump focus back to the top item. Keyed
  // on `items` (not `query`), so typing to search never fights this for focus.
  useEffect(() => {
    setSelectedIndex(0)
    if (items.length > 0) focusItem(0)
  }, [items])

  const moveSelection = (delta: number): void => {
    const next = Math.min(Math.max(selectedIndex + delta, 0), Math.max(filtered.length - 1, 0))
    setSelectedIndex(next)
    focusItem(next)
  }

  const selectCurrent = async (): Promise<void> => {
    const item = filtered[selectedIndex]
    if (!item) return
    await window.api.history.selectItem(bucketId, item.id)
  }

  const selectItem = async (id: string): Promise<void> => {
    await window.api.history.selectItem(bucketId, id)
  }

  // Holding the hotkey's modifiers and releasing them confirms whatever is
  // currently highlighted (see main/shortcuts/holdToSelect.ts). The effect
  // below only subscribes once, so it goes through a ref to always call the
  // latest selectCurrent rather than a stale one from the first render.
  const selectCurrentRef = useRef(selectCurrent)
  useEffect(() => {
    selectCurrentRef.current = selectCurrent
  })
  useEffect(() => {
    return window.api.popup.onConfirmHoldSelection(() => {
      selectCurrentRef.current()
    })
  }, [])

  const togglePin = async (id: string): Promise<void> => {
    const updated = await window.api.history.pinItem(bucketId, id)
    setItems(updated)
  }

  const deleteItem = async (id: string): Promise<void> => {
    const updated = await window.api.history.deleteItem(bucketId, id)
    setItems(updated)
  }

  const currentBucket = buckets.find((b) => b.id === bucketId)

  return {
    items: filtered,
    bucketName: currentBucket?.name ?? '',
    query,
    setQuery,
    selectedIndex,
    moveSelection,
    selectCurrent,
    selectItem,
    togglePin,
    deleteItem,
    registerItemRef
  }
}
