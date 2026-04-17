const MODEL_CACHE = 'ai-model-v1'
const MODEL_URL = 'public/models/yolov8n.onnx'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(MODEL_CACHE).then((cache) => cache.add(MODEL_URL))
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/models/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    )
  }
})