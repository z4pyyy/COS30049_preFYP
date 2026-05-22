// public/workers/yolo.worker.js
// Runs entirely off the main thread.
// Receives ImageBitmap frames, runs ONNX inference, returns parsed detections.
//
// MODEL: YOLOv8n pretrained on COCO-80 (yolov8n_coco.onnx)
// Output shape: [1, 84, 8400] — 80 class scores + 4 bbox coords × 8400 anchors
//
// COCO classes are remapped to the project's 3-class schema:
//   person   (sfcId 0) ← COCO class 0
//   wildlife (sfcId 1) ← COCO classes 14-23 (bird, cat, dog, horse, sheep, cow, elephant, bear, zebra, giraffe)
//   plant    (sfcId 2) ← COCO class 58 (potted plant)
//
// Hands are NOT detected here — MediaPipe HandLandmarker handles hands on the main thread.

importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort.min.js')

// ── Config ───────────────────────────────────────────────────────────────────
const INPUT_SIZE       = 640
const IOU_THRESHOLD    = 0.45
const NUM_BOXES        = 8400
const NUM_COCO_CLASSES = 80

// ── COCO → SFC class mapping ─────────────────────────────────────────────────
// Only these COCO classes are relevant. Everything else (car, chair, etc.) is ignored.
const COCO_TO_SFC = {
  0:  { sfcId: 0, sfcLabel: 'person',   cocoLabel: 'wildlife' },
  14: { sfcId: 1, sfcLabel: 'wildlife', cocoLabel: 'wildlife' },
  15: { sfcId: 1, sfcLabel: 'wildlife', cocoLabel: 'wildlife' },
  16: { sfcId: 1, sfcLabel: 'wildlife', cocoLabel: 'wildlife' },
  17: { sfcId: 1, sfcLabel: 'wildlife', cocoLabel: 'wildlife' },
  18: { sfcId: 1, sfcLabel: 'wildlife', cocoLabel: 'wildlife' },
  19: { sfcId: 1, sfcLabel: 'wildlife', cocoLabel: 'wildlife' },
  20: { sfcId: 1, sfcLabel: 'wildlife', cocoLabel: 'wildlife' },
  21: { sfcId: 1, sfcLabel: 'wildlife', cocoLabel: 'wildlife' },
  22: { sfcId: 1, sfcLabel: 'wildlife', cocoLabel: 'wildlife' },
  23: { sfcId: 1, sfcLabel: 'wildlife', cocoLabel: 'wildlife' },
  58: { sfcId: 2, sfcLabel: 'plant',    cocoLabel: 'plant' },
}

// Fast lookup set for the hot loop
const RELEVANT_COCO_IDS = new Set(Object.keys(COCO_TO_SFC).map(Number))

// Per-SFC-class confidence thresholds
const SFC_CONF_THRESHOLD = {
  0: 0.45,  // person
  1: 0.35,  // wildlife
  2: 0.15,  // plant
}

// ── State ────────────────────────────────────────────────────────────────────
let session = null
let canvas  = null
let ctx     = null
let float32 = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE)

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/'
  ort.env.wasm.numThreads = 2

  canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE)
  ctx    = canvas.getContext('2d')

  session = await ort.InferenceSession.create('/models/yolov8n_coco.onnx', {
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

  // Suppress person boxes that heavily overlap wildlife/plant —
  // hand/arm near animal causes YOLO to classify region as person,
  // stealing the wildlife detection
  const wildlife = kept.filter(d => d.classId === 1 || d.classId === 2)
  if (wildlife.length > 0) {
    return kept.filter(d => {
      if (d.classId !== 0) return true
      return !wildlife.some(w => iou(d.box, w.box) > 0.3)
    })
  }

  return kept
}

// ── Letterbox ────────────────────────────────────────────────────────────────
function letterboxDraw(bitmap) {
  const scale = Math.min(INPUT_SIZE / bitmap.width, INPUT_SIZE / bitmap.height)
  const newW  = Math.round(bitmap.width  * scale)
  const newH  = Math.round(bitmap.height * scale)
  const padX  = Math.floor((INPUT_SIZE - newW) / 2)
  const padY  = Math.floor((INPUT_SIZE - newH) / 2)

  ctx.fillStyle = 'rgb(114,114,114)'
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE)
  ctx.drawImage(bitmap, padX, padY, newW, newH)

  return { scale, padX, padY }
}

// ── Inference ────────────────────────────────────────────────────────────────
async function runInference(bitmap) {
  if (!session) return null

  const { scale, padX, padY } = letterboxDraw(bitmap)
  bitmap.close()

  const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  const px = imageData.data
  const stride = INPUT_SIZE * INPUT_SIZE

  for (let i = 0; i < stride; i++) {
    const idx = i * 4
    float32[i]            = px[idx]     / 255
    float32[stride + i]   = px[idx + 1] / 255
    float32[stride*2 + i] = px[idx + 2] / 255
  }

  const tensor  = new ort.Tensor('float32', float32, [1, 3, INPUT_SIZE, INPUT_SIZE])
  const results = await session.run({ images: tensor })
  const output  = results['output0'].data // Float32Array [1, 84, 8400]

  const detected = []
  for (let i = 0; i < NUM_BOXES; i++) {
    // Find best scoring class across all 80 COCO classes
    let bestCocoClass = -1, bestScore = 0
    for (let c = 0; c < NUM_COCO_CLASSES; c++) {
      const score = output[(4 + c) * NUM_BOXES + i]
      if (score > bestScore) { bestScore = score; bestCocoClass = c }
    }

    // Skip irrelevant COCO classes (car, chair, laptop, etc.)
    if (!RELEVANT_COCO_IDS.has(bestCocoClass)) continue

    const mapping = COCO_TO_SFC[bestCocoClass]

    // Apply per-class confidence threshold
    if (bestScore < (SFC_CONF_THRESHOLD[mapping.sfcId] ?? 0.35)) continue

    const cx = output[0 * NUM_BOXES + i]
    const cy = output[1 * NUM_BOXES + i]
    const w  = output[2 * NUM_BOXES + i]
    const h  = output[3 * NUM_BOXES + i]

    const x1 = (cx - w / 2 - padX) / (INPUT_SIZE - 2 * padX)
    const y1 = (cy - h / 2 - padY) / (INPUT_SIZE - 2 * padY)
    const x2 = (cx + w / 2 - padX) / (INPUT_SIZE - 2 * padX)
    const y2 = (cy + h / 2 - padY) / (INPUT_SIZE - 2 * padY)

    const bw = x2 - x1
    const bh = y2 - y1
    if (bw < 0.01 || bh < 0.01 || bw > 0.85 || bh > 0.85) continue

    detected.push({
      classId:    mapping.sfcId,
      label:      mapping.sfcLabel,
      cocoLabel:  mapping.cocoLabel,
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