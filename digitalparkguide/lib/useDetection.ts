import { useEffect, useRef, useState } from 'react'
import * as ort from 'onnxruntime-web'

const TARGET_CLASSES = new Set([0, 1, 2, 3]) // flower, hand, person, wildlife

const CLASS_NAMES: Record<number, string> = {
  0: 'flower',
  1: 'hand',
  2: 'person',
  3: 'wildlife'
}

interface Detection {
  classId: number
  label: string
  confidence: number
  box: [number, number, number, number]
}

interface AlertEvent {
  timestamp: string
  handBox: Detection
  targetBox: Detection
  confidence: number
}

function iou(a: [number,number,number,number], b: [number,number,number,number]) {
  const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3])
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const aArea = (a[2]-a[0]) * (a[3]-a[1])
  const bArea = (b[2]-b[0]) * (b[3]-b[1])
  return inter / (aArea + bArea - inter)
}

function nms(detections: Detection[], iouThreshold = 0.45): Detection[] {
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence)
  const kept: Detection[] = []
  for (const det of sorted) {
    const overlap = kept.some(
      (k) => k.classId === det.classId && iou(k.box, det.box) > iouThreshold
    )
    if (!overlap) kept.push(det)
  }
  return kept
}

export function useDetection(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const sessionRef = useRef<ort.InferenceSession | null>(null)
  const [modelReady, setModelReady] = useState(false)
  const [detections, setDetections] = useState<Detection[]>([])
  const [alert, setAlert] = useState<AlertEvent | null>(null)
  const alertCooldown = useRef(false)
  const inferenceRunning = useRef(false)

  useEffect(() => {
    ort.env.wasm.proxy = true
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/'
    ort.InferenceSession.create('/models/retrained.onnx', {
      executionProviders: ['wasm'],
    }).then((session) => {
      sessionRef.current = session
      setModelReady(true)
    }).catch((err) => {
      console.error('Failed to load model:', err)
    })
  }, [])

  async function runInference(): Promise<Detection[] | null> {
    if (inferenceRunning.current) return null
    inferenceRunning.current = true

    try {
      const canvas = canvasRef.current
      const session = sessionRef.current
      if (!canvas || !session) return null

      const ctx = canvas.getContext('2d')!
      const imageData = ctx.getImageData(0, 0, 640, 640)

      const float32 = new Float32Array(3 * 640 * 640)
      for (let i = 0; i < 640 * 640; i++) {
        float32[i]             = imageData.data[i * 4]     / 255
        float32[640*640 + i]   = imageData.data[i * 4 + 1] / 255
        float32[2*640*640 + i] = imageData.data[i * 4 + 2] / 255
      }

      const tensor = new ort.Tensor('float32', float32, [1, 3, 640, 640])
      const results = await session.run({ images: tensor })
      const output = results['output0'].data as Float32Array
      const numBoxes = 8400
      const numClasses = 4
      const detected: Detection[] = []

      for (let i = 0; i < numBoxes; i++) {
        let bestClass = -1, bestScore = 0
        for (let c = 0; c < numClasses; c++) {
          const score = output[(4 + c) * numBoxes + i]
          if (score > bestScore) { bestScore = score; bestClass = c }
        }

        if (bestScore < 0.30) continue
        if (!TARGET_CLASSES.has(bestClass)) continue

        const cx = output[0 * numBoxes + i] / 640
        const cy = output[1 * numBoxes + i] / 640
        const w  = output[2 * numBoxes + i] / 640
        const h  = output[3 * numBoxes + i] / 640

        detected.push({
          classId: bestClass,
          label: CLASS_NAMES[bestClass] ?? `class_${bestClass}`,
          confidence: bestScore,
          box: [cx - w/2, cy - h/2, cx + w/2, cy + h/2],
        })
      }

      const sizeFiltered = detected.filter(d => {
        const w = d.box[2] - d.box[0]
        const h = d.box[3] - d.box[1]
        return w < 0.8 && h < 0.8
      })
      const filtered = nms(sizeFiltered, 0.45)
      setDetections(filtered)

      if (!alertCooldown.current) {
        const hands = filtered.filter(d => d.classId === 1)
        const targets = filtered.filter(d => d.classId === 0 || d.classId === 3)

        for (const hand of hands) {
          for (const target of targets) {
            const expandedTarget = expandBox(target.box, 0.15)
            if (iou(hand.box, expandedTarget) > 0.08) {
              triggerAlert({ hand, target })
              return filtered
            }
          }
        }
      }

      return filtered

    } finally {
      inferenceRunning.current = false
    }
  }

  function expandBox(
    box: [number, number, number, number],
    padding: number
  ): [number, number, number, number] {
    return [
      Math.max(0, box[0] - padding),
      Math.max(0, box[1] - padding),
      Math.min(1, box[2] + padding),
      Math.min(1, box[3] + padding),
    ]
  }

  function triggerAlert({ hand, target }: { hand: Detection; target: Detection }) {
    alertCooldown.current = true
    setTimeout(() => { alertCooldown.current = false }, 10000)

    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.start(); osc.stop(ctx.currentTime + 0.8)

    setAlert({
      timestamp: new Date().toISOString(),
      handBox: hand,
      targetBox: target,
      confidence: Math.min(hand.confidence, target.confidence),
    })
  }

  return { modelReady, detections, alert, clearAlert: () => setAlert(null), runInference }
}