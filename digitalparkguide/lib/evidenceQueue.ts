const DB_NAME = 'digitalparkguide_evidence'
const DB_VERSION = 1
const STORE_NAME = 'evidence_queue'

export interface LocalEvidenceClip {
  localQueueId: string
  clipBlob: Blob
  thumbnailBlob: Blob
  mimeType: string
  detectedAt: string
  durationSeconds: number
  detectionType: string
  confidenceScore: number
  trackId: string | null
  tpaLabel: string | null
  guideId: string
  syncStatus: 'pending' | 'uploading' | 'synced' | 'failed'
  retryCount: number
  clipUrl?: string
  thumbnailUrl?: string
  markedForDeletion?: boolean
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'localQueueId' })
        store.createIndex('syncStatus', 'syncStatus', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txStore(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function enqueueClip(clip: LocalEvidenceClip): Promise<void> {
  const db = await openDB()
  await reqToPromise(txStore(db, 'readwrite').put(clip))
  db.close()
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sanitizeClip(clip: LocalEvidenceClip): LocalEvidenceClip {
  if (clip.trackId && !UUID_RE.test(clip.trackId)) {
    clip.tpaLabel = clip.tpaLabel || clip.trackId
    clip.trackId = null
  }
  if (!clip.mimeType || clip.mimeType === 'application/octet-stream') {
    clip.mimeType = 'video/webm'
  }
  return clip
}

export async function getPendingClips(): Promise<LocalEvidenceClip[]> {
  const db = await openDB()
  const store = txStore(db, 'readonly')
  const index = store.index('syncStatus')
  const pending = await reqToPromise(index.getAll('pending'))
  const failed = await reqToPromise(index.getAll('failed'))
  db.close()
  return [...pending, ...failed].filter(c => c.retryCount < 3).map(sanitizeClip)
}

export async function updateClipSyncStatus(
  localQueueId: string,
  status: 'uploading' | 'synced' | 'failed',
  remoteUrls?: { clipUrl: string; thumbnailUrl: string }
): Promise<void> {
  const db = await openDB()
  const store = txStore(db, 'readwrite')
  const clip: LocalEvidenceClip | undefined = await reqToPromise(store.get(localQueueId))
  if (!clip) { db.close(); return }

  clip.syncStatus = status
  if (status === 'failed') clip.retryCount = (clip.retryCount || 0) + 1
  if (remoteUrls) {
    clip.clipUrl = remoteUrls.clipUrl
    clip.thumbnailUrl = remoteUrls.thumbnailUrl
  }
  await reqToPromise(store.put(clip))
  db.close()
}

export async function removeFromQueue(localQueueId: string): Promise<void> {
  const db = await openDB()
  await reqToPromise(txStore(db, 'readwrite').delete(localQueueId))
  db.close()
}

export async function getPendingCount(): Promise<number> {
  const db = await openDB()
  const store = txStore(db, 'readonly')
  const index = store.index('syncStatus')
  const pending = await reqToPromise(index.count('pending'))
  const failed = await reqToPromise(index.count('failed'))
  db.close()
  return pending + failed
}

export async function resetFailedClips(): Promise<number> {
  const db = await openDB()
  const store = txStore(db, 'readwrite')
  const index = store.index('syncStatus')
  const failed: LocalEvidenceClip[] = await reqToPromise(index.getAll('failed'))
  for (const clip of failed) {
    sanitizeClip(clip)
    clip.syncStatus = 'pending'
    clip.retryCount = 0
    await reqToPromise(store.put(clip))
  }
  db.close()
  return failed.length
}

export async function getAllClips(): Promise<LocalEvidenceClip[]> {
  const db = await openDB()
  const store = txStore(db, 'readonly')
  const all: LocalEvidenceClip[] = await reqToPromise(store.getAll())
  db.close()
  return all.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
}

export async function markForDeletion(localQueueId: string): Promise<void> {
  const db = await openDB()
  const store = txStore(db, 'readwrite')
  const clip: LocalEvidenceClip | undefined = await reqToPromise(store.get(localQueueId))
  if (!clip) { db.close(); return }
  clip.markedForDeletion = true
  await reqToPromise(store.put(clip))
  db.close()
}
