import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync, promises as fsp } from 'node:fs'
import { join } from 'node:path'
import {
  Bucket,
  ClipItem,
  DEFAULT_BUCKET_NAME,
  MAX_BUCKET_NAME_LENGTH,
  PopupView,
  SourceApp
} from '@shared/types'

interface BucketRecord extends Bucket {
  items: ClipItem[]
}

interface HistoryFile {
  version: 2
  currentBucketId: string
  buckets: BucketRecord[]
}

type Result<T = void> = { ok: true; value: T } | { ok: false; error: string }

const SAVE_DEBOUNCE_MS = 300

let filePath = ''
let data: HistoryFile | null = null
let dirty = false
let saveTimer: NodeJS.Timeout | null = null
let pendingWrite: Promise<void> = Promise.resolve()
// A background write whose snapshot is older than the last committed one must
// not overwrite newer data on disk (possible when quitting mid-write).
let snapshotSeq = 0
let committedSeq = 0

// The whole history lives in memory and is written back to disk in the
// background. electron-store re-reads and re-parses the entire JSON file on
// every get(), which would make every popup open and every copy pay for disk
// I/O proportional to total history size (all buckets, icons included).
function ensureLoaded(): HistoryFile {
  if (data) return data
  filePath = join(app.getPath('userData'), 'history.json')
  data = load()
  if (dirty) markDirty()
  return data
}

function freshFile(): HistoryFile {
  const bucket: BucketRecord = { id: randomUUID(), name: DEFAULT_BUCKET_NAME, items: [] }
  return { version: 2, currentBucketId: bucket.id, buckets: [bucket] }
}

function load(): HistoryFile {
  if (!existsSync(filePath)) return freshFile()

  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (err) {
    console.error('[historyStore] history.json is unreadable, keeping a backup and starting fresh:', err)
    copyFileSync(filePath, `${filePath}.corrupt.bak`)
    return freshFile()
  }

  const file = raw as { buckets?: BucketRecord[]; items?: ClipItem[]; currentBucketId?: string }

  if (Array.isArray(file.buckets)) {
    return normalize({ version: 2, currentBucketId: file.currentBucketId ?? '', buckets: file.buckets })
  }

  // Legacy v1 format: a single flat list. Keep the original file around once
  // before rewriting it, so nothing a user had is ever lost to the migration.
  const backupPath = `${filePath}.v1.bak`
  if (!existsSync(backupPath)) copyFileSync(filePath, backupPath)
  const migrated: BucketRecord = { id: randomUUID(), name: DEFAULT_BUCKET_NAME, items: file.items ?? [] }
  const migratedFile: HistoryFile = { version: 2, currentBucketId: migrated.id, buckets: [migrated] }
  dirty = true
  return migratedFile
}

function normalize(file: HistoryFile): HistoryFile {
  if (file.buckets.length === 0) {
    const bucket: BucketRecord = { id: randomUUID(), name: DEFAULT_BUCKET_NAME, items: [] }
    return { version: 2, currentBucketId: bucket.id, buckets: [bucket] }
  }
  if (!file.buckets.some((b) => b.id === file.currentBucketId)) {
    file.currentBucketId = file.buckets[0].id
  }
  return file
}

function markDirty(): void {
  dirty = true
  if (!saveTimer) saveTimer = setTimeout(flushInBackground, SAVE_DEBOUNCE_MS)
}

function flushInBackground(): void {
  saveTimer = null
  if (!dirty || !data) return
  dirty = false
  const mySeq = ++snapshotSeq
  const payload = JSON.stringify(data)
  pendingWrite = pendingWrite
    .then(() => writeAtomicAsync(payload, mySeq))
    .catch((err) => console.error('[historyStore] background save failed:', err))
}

async function writeAtomicAsync(payload: string, mySeq: number): Promise<void> {
  const tmp = `${filePath}.${randomUUID()}.tmp`
  await fsp.writeFile(tmp, payload, 'utf8')
  if (mySeq < committedSeq) {
    await fsp.unlink(tmp)
    return
  }
  committedSeq = mySeq
  await fsp.rename(tmp, filePath)
}

/** Synchronously persists any pending changes — call on quit so nothing is lost. */
export function flushHistorySync(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (!dirty || !data) return
  dirty = false
  committedSeq = ++snapshotSeq
  const tmp = `${filePath}.${randomUUID()}.tmp`
  writeFileSync(tmp, JSON.stringify(data), 'utf8')
  renameSync(tmp, filePath)
}

function bucketRecord(file: HistoryFile, bucketId: string): BucketRecord | undefined {
  return file.buckets.find((b) => b.id === bucketId)
}

function trim(items: ClipItem[], maxHistorySize: number): ClipItem[] {
  const pinned = items.filter((i) => i.pinned)
  const unpinned = items.filter((i) => !i.pinned)
  const keepUnpinned = unpinned.slice(0, Math.max(0, maxHistorySize - pinned.length))
  const keepIds = new Set([...pinned, ...keepUnpinned].map((i) => i.id))
  return items.filter((i) => keepIds.has(i.id))
}

function validateBucketName(file: HistoryFile, name: string, exceptId?: string): Result<string> {
  const trimmed = name.trim()
  if (trimmed.length === 0) return { ok: false, error: 'Bucket name cannot be empty' }
  if (trimmed.length > MAX_BUCKET_NAME_LENGTH) {
    return { ok: false, error: `Bucket name must be at most ${MAX_BUCKET_NAME_LENGTH} characters` }
  }
  const lower = trimmed.toLowerCase()
  if (file.buckets.some((b) => b.id !== exceptId && b.name.toLowerCase() === lower)) {
    return { ok: false, error: `A bucket named "${trimmed}" already exists` }
  }
  return { ok: true, value: trimmed }
}

export function getBuckets(): Bucket[] {
  return ensureLoaded().buckets.map(({ id, name }) => ({ id, name }))
}

export function getCurrentBucketId(): string {
  return ensureLoaded().currentBucketId
}

export function getView(): PopupView {
  const file = ensureLoaded()
  return {
    buckets: file.buckets.map(({ id, name }) => ({ id, name })),
    currentBucketId: file.currentBucketId,
    items: bucketRecord(file, file.currentBucketId)?.items.slice() ?? []
  }
}

export function getItems(bucketId: string): ClipItem[] {
  return bucketRecord(ensureLoaded(), bucketId)?.items.slice() ?? []
}

export function setCurrentBucket(bucketId: string): Result<Bucket> {
  const file = ensureLoaded()
  const bucket = bucketRecord(file, bucketId)
  if (!bucket) return { ok: false, error: 'Bucket not found' }
  if (file.currentBucketId !== bucketId) {
    file.currentBucketId = bucketId
    markDirty()
  }
  return { ok: true, value: { id: bucket.id, name: bucket.name } }
}

export function cycleBucket(delta: 1 | -1): Bucket {
  const file = ensureLoaded()
  const index = file.buckets.findIndex((b) => b.id === file.currentBucketId)
  const next = file.buckets[(index + delta + file.buckets.length) % file.buckets.length]
  file.currentBucketId = next.id
  markDirty()
  return { id: next.id, name: next.name }
}

export function addOrMergeToTop(
  bucketId: string,
  text: string,
  maxHistorySize: number,
  sourceApp?: SourceApp
): ClipItem[] {
  const bucket = bucketRecord(ensureLoaded(), bucketId)
  if (!bucket) return []
  const existingIndex = bucket.items.findIndex((i) => i.text === text)
  let entry: ClipItem
  let rest: ClipItem[]
  if (existingIndex >= 0) {
    entry = sourceApp ? { ...bucket.items[existingIndex], sourceApp } : bucket.items[existingIndex]
    rest = bucket.items.filter((_, i) => i !== existingIndex)
  } else {
    entry = { id: randomUUID(), text, createdAt: Date.now(), pinned: false, sourceApp }
    rest = bucket.items
  }
  bucket.items = trim([entry, ...rest], maxHistorySize)
  markDirty()
  return bucket.items.slice()
}

export function setItemSourceApp(bucketId: string, id: string, sourceApp: SourceApp): void {
  const bucket = bucketRecord(ensureLoaded(), bucketId)
  const item = bucket?.items.find((i) => i.id === id)
  if (!item) return
  item.sourceApp = sourceApp
  markDirty()
}

export function togglePin(bucketId: string, id: string): ClipItem[] {
  const bucket = bucketRecord(ensureLoaded(), bucketId)
  const item = bucket?.items.find((i) => i.id === id)
  if (item) {
    item.pinned = !item.pinned
    markDirty()
  }
  return bucket?.items.slice() ?? []
}

export function removeItem(bucketId: string, id: string): ClipItem[] {
  const bucket = bucketRecord(ensureLoaded(), bucketId)
  if (bucket) {
    bucket.items = bucket.items.filter((i) => i.id !== id)
    markDirty()
  }
  return bucket?.items.slice() ?? []
}

export function clearAll(bucketId: string): ClipItem[] {
  const bucket = bucketRecord(ensureLoaded(), bucketId)
  if (bucket) {
    bucket.items = bucket.items.filter((i) => i.pinned)
    markDirty()
  }
  return bucket?.items.slice() ?? []
}

export function updateItemText(bucketId: string, id: string, text: string): Result<ClipItem[]> {
  const bucket = bucketRecord(ensureLoaded(), bucketId)
  if (!bucket) return { ok: false, error: 'Bucket not found' }
  const item = bucket.items.find((i) => i.id === id)
  if (!item) return { ok: false, error: 'Item not found' }
  if (text.trim().length === 0) return { ok: false, error: 'Item text cannot be empty' }
  item.text = text
  markDirty()
  return { ok: true, value: bucket.items.slice() }
}

export function createBucket(name: string): Result<Bucket> {
  const file = ensureLoaded()
  const valid = validateBucketName(file, name)
  if (!valid.ok) return valid
  const bucket: BucketRecord = { id: randomUUID(), name: valid.value, items: [] }
  file.buckets.push(bucket)
  markDirty()
  return { ok: true, value: { id: bucket.id, name: bucket.name } }
}

export function renameBucket(bucketId: string, name: string): Result<Bucket> {
  const file = ensureLoaded()
  const bucket = bucketRecord(file, bucketId)
  if (!bucket) return { ok: false, error: 'Bucket not found' }
  const valid = validateBucketName(file, name, bucketId)
  if (!valid.ok) return valid
  bucket.name = valid.value
  markDirty()
  return { ok: true, value: { id: bucket.id, name: bucket.name } }
}

export function deleteBucket(bucketId: string): Result {
  const file = ensureLoaded()
  if (file.buckets.length <= 1) return { ok: false, error: 'At least one bucket must remain' }
  const index = file.buckets.findIndex((b) => b.id === bucketId)
  if (index < 0) return { ok: false, error: 'Bucket not found' }
  file.buckets.splice(index, 1)
  if (file.currentBucketId === bucketId) file.currentBucketId = file.buckets[0].id
  markDirty()
  return { ok: true, value: undefined }
}
