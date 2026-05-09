// public/workers/yolo.worker.js
// Runs entirely off the main thread.
// Receives ImageBitmap frames, runs ONNX inference, returns parsed detections.

importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort.min.js')

// ── Config ───────────────────────────────────────────────────────────────────
const INPUT_SIZE = 640
const CONF_THRESHOLD = 0.30
const IOU_THRESHOLD  = 0.45
const NUM_BOXES      = 8400
const NUM_CLASSES    = 4

const CLASS_NAMES = { 0: 'flower', 1: 'hand', 2: 'person', 3: 'wildlife' }

// ── State ────────────────────────────────────────────────────────────────────
let session = null
let canvas  = null
let ctx     = null
// Reuse Float32Array across frames — avoids GC pressure
let float32 = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE)

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/'
  ort.env.wasm.numThreads = 2 // leave cores for main thread + MediaPipe

  // OffscreenCanvas for frame preprocessing inside worker
  canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE)
  ctx    = canvas.getContext('2d')

  session = await ort.InferenceSession.create('/models/retrained.onnx', {
    executionProviders: ['wasm'],
  })

  self.postMessage({ type: 'ready' })
}

// ── NMS ──────────────────────────────────────────────────────────────────────
function iou(a, b) {
  const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3])
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const aArea = (a[2] - a[0]) * (a[3] - a[1])
  const bArea = (b[2] - b[0]) * (b[3] - b[1])
  return inter / (aArea + bArea - inter)
}

function nms(detections) {
  const sorted = detections.slice().sort((a, b) => b.confidence - a.confidence)
  const kept = []
  for (const det of sorted) {
    const overlap = kept.some(
      k => k.classId === det.classId && iou(k.box, det.box) > IOU_THRESHOLD
    )
    if (!overlap) kept.push(det)
  }
  return kept
}

// ── Letterbox ────────────────────────────────────────────────────────────────
// Scales the frame to fit inside INPUT_SIZE×INPUT_SIZE with padding,
// preserving aspect ratio. Returns {scale, padX, padY} for coordinate remapping.
function letterboxDraw(bitmap) {
  const scale = Math.min(INPUT_SIZE / bitmap.width, INPUT_SIZE / bitmap.height)
  const newW  = Math.round(bitmap.width  * scale)
  const newH  = Math.round(bitmap.height * scale)
  const padX  = Math.floor((INPUT_SIZE - newW) / 2)
  const padY  = Math.floor((INPUT_SIZE - newH) / 2)

  // Fill background grey (114,114,114) — YOLOv8 default letterbox colour
  ctx.fillStyle = 'rgb(114,114,114)'
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE)
  ctx.drawImage(bitmap, padX, padY, newW, newH)

  return { scale, padX, padY }
}

// ── Inference ────────────────────────────────────────────────────────────────
async function runInference(bitmap) {
  if (!session) return null

  const { scale, padX, padY } = letterboxDraw(bitmap)
  bitmap.close() // release GPU memory immediately

  // RGB channel separation — reuses pre-allocated Float32Array
  const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  const px = imageData.data
  const stride = INPUT_SIZE * INPUT_SIZE

  for (let i = 0; i < stride; i++) {
    const idx = i * 4
    float32[i]            = px[idx]     / 255  // R
    float32[stride + i]   = px[idx + 1] / 255  // G
    float32[stride*2 + i] = px[idx + 2] / 255  // B
  }

  const tensor  = new ort.Tensor('float32', float32, [1, 3, INPUT_SIZE, INPUT_SIZE])
  const results = await session.run({ images: tensor })
  const output  = results['output0'].data // Float32Array

  // Parse boxes
  const detected = []
  for (let i = 0; i < NUM_BOXES; i++) {
    let bestClass = -1, bestScore = 0
    for (let c = 0; c < NUM_CLASSES; c++) {
      const score = output[(4 + c) * NUM_BOXES + i]
      if (score > bestScore) { bestScore = score; bestClass = c }
    }
    if (bestScore < CONF_THRESHOLD || bestClass < 0) continue

    // Raw coords in letterboxed 640×640 space → normalised 0-1 in original frame
    const cx = output[0 * NUM_BOXES + i]
    const cy = output[1 * NUM_BOXES + i]
    const w  = output[2 * NUM_BOXES + i]
    const h  = output[3 * NUM_BOXES + i]

    // Remove letterbox padding, rescale to original frame dimensions
    const x1 = (cx - w / 2 - padX) / (INPUT_SIZE - 2 * padX)
    const y1 = (cy - h / 2 - padY) / (INPUT_SIZE - 2 * padY)
    const x2 = (cx + w / 2 - padX) / (INPUT_SIZE - 2 * padX)
    const y2 = (cy + h / 2 - padY) / (INPUT_SIZE - 2 * padY)

    const bw = x2 - x1
    const bh = y2 - y1
    // Filter tiny boxes and huge boxes (noise / full-frame false detections)
    if (bw < 0.01 || bh < 0.01 || bw > 0.85 || bh > 0.85) continue

    detected.push({
      classId:    bestClass,
      label:      CLASS_NAMES[bestClass] ?? `class_${bestClass}`,
      confidence: bestScore,
      box: [
        Math.max(0, x1), Math.max(0, y1),
        Math.min(1, x2), Math.min(1, y2),
      ],
    })
  }

  return nms(detected)
}

// ── Message handler ──────────────────────────────────────────────────────────
self.addEventListener('message', async (e) => {
  const { type, bitmap } = e.data

  if (type === 'init') {
    await init()
    return
  }

  if (type === 'frame') {
    if (!session) {
      bitmap?.close()
      return
    }
    try {
      const detections = await runInference(bitmap)
      self.postMessage({ type: 'detections', detections })
    } catch (err) {
      bitmap?.close()
      self.postMessage({ type: 'error', message: err.message })
    }
  }
})
