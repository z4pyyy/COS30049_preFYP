//sw.js
const CACHE_VERSION = 'v3'
const MODEL_CACHE = `ai-model-${CACHE_VERSION}`
const APP_CACHE = `app-shell-${CACHE_VERSION}`
const SYNC_TAG = 'evidence-sync'

const MODEL_URLS = [
  '/models/retrained.onnx',
  '/models/hand_landmarker.task',
]

const APP_SHELL = [
  '/',
  '/dashboard',
  '/monitor',
  '/manifest.json',
  '/images/SFC_LOGO.png',
  '/mediapipe/wasm/vision_wasm_internal.js',
  '/mediapipe/wasm/vision_wasm_internal.wasm',
  '/mediapipe/wasm/vision_wasm_module_internal.js',
  '/mediapipe/wasm/vision_wasm_module_internal.wasm',
]

// Install: pre-cache model + app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(MODEL_CACHE).then((cache) => cache.addAll(MODEL_URLS)),
      caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)),
    ]).then(() => self.skipWaiting())
  )
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== MODEL_CACHE && k !== APP_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// Fetch: cache-first for models, network-first for app
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Model files: cache-first (large, rarely change)
  if (url.pathname.startsWith('/models/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(MODEL_CACHE).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // API calls: network-only (no caching)
  if (url.pathname.startsWith('/api/')) return

  // App routes: network-first with cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone()
          caches.open(APP_CACHE).then((cache) => cache.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Static assets: cache-first
  if (url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(APP_CACHE).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
    return
  }
})

// Background Sync: retry evidence uploads when connectivity restored
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncEvidence())
  }
})

async function syncEvidence() {
  // Open IndexedDB from service worker context
  const db = await openEvidenceDB()
  const tx = db.transaction('evidence_queue', 'readonly')
  const store = tx.objectStore('evidence_queue')
  const index = store.index('syncStatus')

  const pending = await getAllFromIndex(index, 'pending')
  const failed = await getAllFromIndex(index, 'failed')
  const clips = [...pending, ...failed].filter((c) => (c.retryCount || 0) < 3)

  if (clips.length === 0) return

  // Notify clients about sync start
  const clients = await self.clients.matchAll()
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_START', count: clips.length })
  })

  let synced = 0
  for (const clip of clips) {
    try {
      // Upload to Supabase via the app's API
      const formData = new FormData()
      formData.append('clip', clip.clipBlob)
      formData.append('thumbnail', clip.thumbnailBlob)
      formData.append('metadata', JSON.stringify({
        localQueueId: clip.localQueueId,
        guideId: clip.guideId,
        trackId: clip.trackId,
        detectedAt: clip.detectedAt,
        durationSeconds: clip.durationSeconds,
        detectionType: clip.detectionType,
        confidenceScore: clip.confidenceScore,
        mimeType: clip.mimeType,
      }))

      const res = await fetch('/api/evidence/upload', { method: 'POST', body: formData })
      if (res.ok) {
        await removeFromDB(db, clip.localQueueId)
        synced++
      } else {
        await incrementRetry(db, clip.localQueueId)
      }
    } catch {
      await incrementRetry(db, clip.localQueueId)
    }
  }

  // Notify clients about sync completion
  const clientsAfter = await self.clients.matchAll()
  clientsAfter.forEach((client) => {
    client.postMessage({ type: 'SYNC_COMPLETE', synced, total: clips.length })
  })

  // Show notification
  if (synced > 0 && self.registration.showNotification) {
    self.registration.showNotification('Evidence Synced', {
      body: `${synced} evidence clip${synced > 1 ? 's' : ''} uploaded successfully.`,
      icon: '/images/SFC_LOGO.png',
      badge: '/images/SFC_LOGO.png',
      tag: 'evidence-sync-result',
    })
  }
}

// IndexedDB helpers for service worker context
function openEvidenceDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('digitalparkguide_evidence', 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('evidence_queue')) {
        const store = db.createObjectStore('evidence_queue', { keyPath: 'localQueueId' })
        store.createIndex('syncStatus', 'syncStatus', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function getAllFromIndex(index, value) {
  return new Promise((resolve, reject) => {
    const req = index.getAll(value)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function removeFromDB(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('evidence_queue', 'readwrite')
    const req = tx.objectStore('evidence_queue').delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function incrementRetry(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('evidence_queue', 'readwrite')
    const store = tx.objectStore('evidence_queue')
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const clip = getReq.result
      if (clip) {
        clip.retryCount = (clip.retryCount || 0) + 1
        clip.syncStatus = 'failed'
        store.put(clip)
      }
      resolve()
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const dashboardClient = clients.find((c) => c.url.includes('/dashboard/evidence'))
      if (dashboardClient) {
        return dashboardClient.focus()
      }
      return self.clients.openWindow('/dashboard/evidence')
    })
  )
})
