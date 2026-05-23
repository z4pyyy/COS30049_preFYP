// lib/useDetection.ts
// Phase 2 — COCO model + MediaPipe Hand Landmarker.
//
// YOLO (COCO-80) runs in Web Worker — detects person/plant/wildlife via class remapping.
// MediaPipe runs on main thread (requires WebGL) — detects hands + classifies pose.
// Violation gate: pose state (plucking/petting) + bbox proximity = confirmed violation.
//
// NEW CLASS IDs (from COCO remap in yolo.worker.js):
//   0 = person
//   1 = wildlife
//   2 = plant
//
// Hands are detected ONLY by MediaPipe HandLandmarker (not YOLO).

import type { SensorAlert } from './useSensorNode'
import { notifyNodeViolation } from './useSensorNode'
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  HandLandmarker,
  FilesetResolver,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Detection {
  classId:    number
  label:      string
  cocoLabel?: string   // e.g. "giraffe", "potted plant" — richer UI labels
  confidence: number
  box:        [number, number, number, number]
}

export interface AlertEvent {
  timestamp:  string
  handBox:    Detection | null
  targetBox:  Detection
  confidence: number
  type:       'hand_near_plant' | 'hand_near_wildlife'
  source:     'ai_pose' | 'sensor_only' | 'sensor_and_pose'
}

type PoseState = 'resting' | 'approaching' | 'plucking' | 'petting'

// ── SFC class IDs (must match yolo.worker.js COCO_TO_SFC mapping) ────────────
const SFC_PERSON   = 0
const SFC_WILDLIFE = 1
const SFC_PLANT    = 2

// MediaPipe landmark indices
const WRIST      = 0
const THUMB_TIP  = 4
const INDEX_TIP  = 8
const INDEX_MCP  = 5
const MIDDLE_TIP = 12
const MIDDLE_MCP = 9
const RING_TIP   = 16
const RING_MCP   = 13
const PINKY_TIP  = 20
const PINKY_MCP  = 17

// ── Geometry helpers ──────────────────────────────────────────────────────────
function dist3D(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2)
}

function extensionRatio(
  lm:      { x: number; y: number; z: number }[],
  tipIdx:  number,
  mcpIdx:  number
): number {
  const tipDist = dist3D(lm[tipIdx], lm[WRIST])
  const mcpDist = dist3D(lm[mcpIdx], lm[WRIST])
  if (mcpDist < 0.001) return 0
  return Math.min(tipDist / (mcpDist * 2.2), 1.0)
}

function iou(
  a: [number,number,number,number],
  b: [number,number,number,number]
): number {
  const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3])
  const inter = Math.max(0, x2-x1) * Math.max(0, y2-y1)
  if (inter === 0) return 0
  return inter / ((a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - inter)
}

function expandBox(
  box: [number,number,number,number],
  pad: number
): [number,number,number,number] {
  return [
    Math.max(0, box[0]-pad), Math.max(0, box[1]-pad),
    Math.min(1, box[2]+pad), Math.min(1, box[3]+pad),
  ]
}

function landmarksToBbox(
  lm: { x: number; y: number }[]
): [number,number,number,number] {
  const xs = lm.map(p => p.x)
  const ys = lm.map(p => p.y)
  return [
    Math.max(0, Math.min(...xs) - 0.02),
    Math.max(0, Math.min(...ys) - 0.02),
    Math.min(1, Math.max(...xs) + 0.02),
    Math.min(1, Math.max(...ys) + 0.02),
  ]
}

// ── Pose classifiers ──────────────────────────────────────────────────────────

// Plucking: thumb-index pinch + other fingers curled
function isPluckingPose(lm: { x: number; y: number; z: number }[]): boolean {
  if (lm.length < 21) return false
  if (dist3D(lm[THUMB_TIP], lm[INDEX_TIP]) > 0.08) return false

  const indexExt  = extensionRatio(lm, INDEX_TIP,  INDEX_MCP)
  const middleExt = extensionRatio(lm, MIDDLE_TIP, MIDDLE_MCP)
  const ringExt   = extensionRatio(lm, RING_TIP,   RING_MCP)
  const pinkyExt  = extensionRatio(lm, PINKY_TIP,  PINKY_MCP)

  if (indexExt  < 0.55) return false
  if (middleExt > 0.65) return false
  if (ringExt   > 0.65) return false
  if (pinkyExt  > 0.65) return false

  return true
}

// Petting: open palm (all fingers extended) + oscillating wrist motion
function isPettingPose(
  lm:           { x: number; y: number; z: number }[],
  wristHistory: { x: number; y: number }[]
): boolean {
  if (lm.length < 21) return false

  const indexExt  = extensionRatio(lm, INDEX_TIP,  INDEX_MCP)
  const middleExt = extensionRatio(lm, MIDDLE_TIP, MIDDLE_MCP)
  const ringExt   = extensionRatio(lm, RING_TIP,   RING_MCP)
  const pinkyExt  = extensionRatio(lm, PINKY_TIP,  PINKY_MCP)

  if (indexExt  < 0.70) return false
  if (middleExt < 0.70) return false
  if (ringExt   < 0.70) return false
  if (pinkyExt  < 0.70) return false

  if (wristHistory.length < 8) return false

  const recent = wristHistory.slice(-10)
  let dirChangesX = 0
  let dirChangesY = 0
  for (let i = 2; i < recent.length; i++) {
    if ((recent[i-1].x - recent[i-2].x) * (recent[i].x - recent[i-1].x) < 0) dirChangesX++
    if ((recent[i-1].y - recent[i-2].y) * (recent[i].y - recent[i-1].y) < 0) dirChangesY++
  }

  return (dirChangesX >= 2 || dirChangesY >= 2)
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useDetection(
  sensorAlertRef?: React.MutableRefObject<SensorAlert | null>
) {
  const workerRef  = useRef<Worker | null>(null)
  const workerBusy = useRef(false)

  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const mediapipeReady    = useRef(false)
  const lastMpTime        = useRef(0)
  const MP_INTERVAL_MS    = 150

  const wristHistory = useRef<{ x: number; y: number }[]>([])
  const poseState    = useRef<PoseState>('resting')
  const alertCooldown = useRef(false)

  const [modelReady, setModelReady] = useState(false)
  const [detections, setDetections] = useState<Detection[]>([])
  const [alert,      setAlert]      = useState<AlertEvent | null>(null)
  const [poseLabel,  setPoseLabel]  = useState<string>('')
  const poseLabelRef = useRef<string>('')

  const detectionsRef = useRef<Detection[]>([])
  const handLmsRef    = useRef<{ x: number; y: number }[][]>([])

  // ── YOLO worker ────────────────────────────────────────────────────────────
  useEffect(() => {
    const worker = new Worker('/workers/yolo.worker.js')
    workerRef.current = worker

    worker.onmessage = (e) => {
      const { type, detections: dets, message } = e.data
      if (type === 'ready')      { setModelReady(true); return }
      if (type === 'detections') {
        workerBusy.current = false
        if (!dets) return
        detectionsRef.current = dets
        setDetections(dets)
        return
      }
      if (type === 'error') {
        workerBusy.current = false
        console.error('[YOLO worker]', message)
      }
    }

    worker.postMessage({ type: 'init' })
    return () => { worker.terminate(); workerRef.current = null }
  }, [])

  // ── MediaPipe HandLandmarker ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode:                  'VIDEO',
          numHands:                     2,
          minHandDetectionConfidence:   0.5,
          minHandPresenceConfidence:    0.5,
          minTrackingConfidence:        0.5,
        })
        if (!cancelled) {
          handLandmarkerRef.current = landmarker
          mediapipeReady.current    = true
          console.log('[MediaPipe] HandLandmarker ready')
        }
      } catch (err) {
        console.error('[MediaPipe] init failed:', err)
      }
    })()
    return () => {
      cancelled = true
      handLandmarkerRef.current?.close()
      handLandmarkerRef.current = null
      mediapipeReady.current = false
    }
  }, [])

  // ── MediaPipe frame processing ─────────────────────────────────────────────
  const runMediaPipe = useCallback((
    video:     HTMLVideoElement,
    timestamp: number
  ) => {
    if (!mediapipeReady.current || !handLandmarkerRef.current) return
    if (video.readyState < 2) return
    if (timestamp - lastMpTime.current < MP_INTERVAL_MS) return
    lastMpTime.current = timestamp

    let result: HandLandmarkerResult
    try {
      result = handLandmarkerRef.current.detectForVideo(video, timestamp)
    } catch (err) {
      console.warn('[MediaPipe] detectForVideo failed (WebGL context lost?):', err)
      mediapipeReady.current = false
      return
    }

    if (result.landmarks.length === 0) {
      handLmsRef.current   = []
      wristHistory.current = []
      poseState.current    = 'resting'
      setPoseLabel('')
      return
    }

    handLmsRef.current = result.landmarks.map(lm =>
      lm.map(p => ({ x: p.x, y: p.y }))
    )

    const worldLms = result.worldLandmarks[0]

    const wrist = result.landmarks[0][WRIST]
    wristHistory.current.push({ x: wrist.x, y: wrist.y })
    if (wristHistory.current.length > 20) wristHistory.current.shift()

    if (isPluckingPose(worldLms)) {
      poseState.current = 'plucking'
      poseLabelRef.current = 'plucking'
      setPoseLabel('plucking')
    } else if (isPettingPose(worldLms, wristHistory.current)) {
      poseState.current = 'petting'
      poseLabelRef.current = 'petting'
      setPoseLabel('petting')
    } else {
      poseState.current = 'approaching'
      poseLabelRef.current = ''
      setPoseLabel('')
    }

    checkViolations()
  }, [])

  // ── Violation gate ─────────────────────────────────────────────────────────
  // CLASS IDs (from COCO remap):
  //   0 = person
  //   1 = wildlife
  //   2 = plant
  const checkViolations = useCallback(() => {
    if (alertCooldown.current) return

    const dets     = detectionsRef.current
    const plants   = dets.filter(d => d.classId === SFC_PLANT)      // was classId === 2 (flower)
    const wildlife = dets.filter(d => d.classId === SFC_WILDLIFE)   // was classId === 3

    // Hands come from MediaPipe landmarks only (COCO doesn't detect hands)
    const handBoxes: [number,number,number,number][] =
      handLmsRef.current.length > 0
        ? handLmsRef.current.map(lm => landmarksToBbox(lm))
        : []

    if (handBoxes.length === 0) return

    // ── Plant violation — ALL THREE required: plucking + bbox overlap + sensor ≤20cm
    if (
      poseState.current === 'plucking' &&
      plants.length > 0 &&
      sensorAlertRef?.current?.active === true &&
      sensorAlertRef.current.distance <= 20
    ) {
      for (const handBox of handBoxes) {
        for (const plant of plants) {
          if (iou(handBox, expandBox(plant.box, 0.12)) > 0.01) {
            triggerAlert({
              handBox: { classId: -1, label: 'hand', confidence: 0.95, box: handBox },
              target:  plant,
              type:    'hand_near_plant',
              source:  'sensor_and_pose',
            })
            return
          }
        }
      }
    }

    // ── Wildlife violation — AI only (sensor not required) ──────────────────
    if (poseState.current === 'petting') {
      for (const handBox of handBoxes) {
        for (const animal of wildlife) {
          if (iou(handBox, expandBox(animal.box, 0.15)) > 0.05) {
            triggerAlert({
              handBox: { classId: -1, label: 'hand', confidence: 0.95, box: handBox },
              target:  animal,
              type:    'hand_near_wildlife',
              source:  'ai_pose',
            })
            return
          }
        }
      }
    }
  }, [])

  // ── Alert ──────────────────────────────────────────────────────────────────
  function triggerAlert({
    handBox, target, type, source,
  }: {
    handBox: Detection
    target:  Detection
    type:    AlertEvent['type']
    source:  AlertEvent['source']
  }) {
    alertCooldown.current = true
    setTimeout(() => { alertCooldown.current = false }, 10_000)

    try {
      const actx = new AudioContext()
      const osc  = actx.createOscillator()
      const gain = actx.createGain()
      osc.connect(gain); gain.connect(actx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.3, actx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.8)
      osc.start(); osc.stop(actx.currentTime + 0.8)
    } catch { /* mobile autoplay block */ }

    if (source === 'sensor_and_pose') {
      notifyNodeViolation()
    }

    setAlert({
      timestamp:  new Date().toISOString(),
      handBox,
      targetBox:  target,
      confidence: Math.min(handBox.confidence, target.confidence),
      type,
      source,
    })
  }

  // ── Send frame to YOLO worker ──────────────────────────────────────────────
  const sendFrame = useCallback((video: HTMLVideoElement) => {
    if (workerBusy.current || !workerRef.current) return
    if (video.readyState < 2) return
    workerBusy.current = true
    createImageBitmap(video)
      .then(bitmap => {
        workerRef.current!.postMessage({ type: 'frame', bitmap }, [bitmap])
      })
      .catch(() => { workerBusy.current = false })
  }, [])

  return {
    modelReady,
    detections,
    detectionsRef,
    handLmsRef,
    poseLabel,
    poseLabelRef,
    alert,
    clearAlert: () => setAlert(null),
    sendFrame,
    runMediaPipe,
  }
}