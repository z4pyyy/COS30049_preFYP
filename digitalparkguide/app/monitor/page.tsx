'use client'

// app/monitor/page.tsx — Phase 2 (COCO model)
// rAF loop now runs both:
//   1. YOLO worker frame dispatch (every Nth frame)
//   2. MediaPipe hand landmarker (every ~80ms on main thread)
// Hand skeleton drawn on overlay canvas alongside YOLO bboxes.
//
// CLASS IDs (from COCO remap — must match yolo.worker.js + useDetection.ts):
//   0 = person
//   1 = wildlife
//   2 = plant
// Hands: MediaPipe only (not in COCO model)

import { useEffect, useRef, useState, useCallback } from 'react'
import { useDetection, type Detection } from '@/lib/useDetection'
import { startPreRollBuffer, stopPreRollBuffer, captureEvidenceClip } from '@/lib/evidence'
import { syncNow, registerAutoSync } from '@/lib/evidenceSync'
import { createClient } from '@/lib/supabase/client'
import ClipQueuePanel from '@/components/ClipQueuePanel'
import { useToast } from '@/components/ui/Toast'
import { useSensorNode } from '@/lib/useSensorNode'

// ── Constants ─────────────────────────────────────────────────────────────────
// SFC class IDs — must match yolo.worker.js COCO_TO_SFC mapping
const SFC_PERSON   = 0
const SFC_WILDLIFE = 1
const SFC_PLANT    = 2

const CLASS_COLORS: Record<number, string> = {
  // [SFC_PERSON]:   '#f97316',  // orange
  [SFC_WILDLIFE]: '#ef4444',  // red
  [SFC_PLANT]:    '#22c55e',  // green
}

const CLASS_LABELS: Record<number, string> = {
  // [SFC_PERSON]:   'person',
  [SFC_WILDLIFE]: 'wildlife',
  [SFC_PLANT]:    'plant',
}

const CLASS_ICONS: Record<number, string> = {
  // [SFC_PERSON]:   'person',
  [SFC_WILDLIFE]: 'pets',
  [SFC_PLANT]:    'local_florist',
}

const CLASS_PILL_STYLES: Record<number, string> = {
  // [SFC_PERSON]:   'bg-surface-container-high text-on-surface-variant',
  [SFC_WILDLIFE]: 'bg-tertiary-container text-on-tertiary-container',
  [SFC_PLANT]:    'bg-green-100 text-green-800',
}

// Hand skeleton connections (MediaPipe 21-point topology)
const HAND_CONNECTIONS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,4],       // thumb
  [0,5],[5,6],[6,7],[7,8],       // index
  [0,9],[9,10],[10,11],[11,12],  // middle
  [0,13],[13,14],[14,15],[15,16],// ring
  [0,17],[17,18],[18,19],[19,20],// pinky
  [5,9],[9,13],[13,17],          // palm cross
]

const INFERENCE_EVERY = 2

// ── Bbox smoothing ───────────────────────────────────────────────────────────
const LERP_SPEED = 0.35

interface SmoothedDetection extends Detection {
  smoothBox: [number, number, number, number]
  missedFrames?: number
}

const PERSIST_FRAMES = 8

function matchDetections(
  prev: SmoothedDetection[],
  next: Detection[]
): SmoothedDetection[] {
  const used = new Set<number>()
  const result: SmoothedDetection[] = []

  for (const det of next) {
    let bestIdx = -1
    let bestDist = Infinity
    for (let i = 0; i < prev.length; i++) {
      if (used.has(i) || prev[i].classId !== det.classId) continue
      const dx = (det.box[0] + det.box[2]) / 2 - (prev[i].smoothBox[0] + prev[i].smoothBox[2]) / 2
      const dy = (det.box[1] + det.box[3]) / 2 - (prev[i].smoothBox[1] + prev[i].smoothBox[3]) / 2
      const d = dx * dx + dy * dy
      if (d < bestDist && d < 0.15) { bestDist = d; bestIdx = i }
    }

    if (bestIdx >= 0) {
      used.add(bestIdx)
      result.push({ ...det, smoothBox: [...prev[bestIdx].smoothBox], missedFrames: 0 })
    } else {
      result.push({ ...det, smoothBox: [...det.box], missedFrames: 0 })
    }
  }

  for (let i = 0; i < prev.length; i++) {
    if (used.has(i)) continue
    const missed = (prev[i].missedFrames ?? 0) + 1
    if (missed <= PERSIST_FRAMES) {
      result.push({ ...prev[i], missedFrames: missed })
    }
  }

  return result
}

function lerpBoxes(dets: SmoothedDetection[], factor: number): void {
  for (const d of dets) {
    d.smoothBox[0] += (d.box[0] - d.smoothBox[0]) * factor
    d.smoothBox[1] += (d.box[1] - d.smoothBox[1]) * factor
    d.smoothBox[2] += (d.box[2] - d.smoothBox[2]) * factor
    d.smoothBox[3] += (d.box[3] - d.smoothBox[3]) * factor
  }
}

interface TrackOption {
  id: string
  title: string
  tpa_name: string
}

// ── Draw YOLO bboxes ──────────────────────────────────────────────────────────
function drawDetections(
  ctx: CanvasRenderingContext2D,
  dets: (Detection | SmoothedDetection)[],
  cw: number,
  ch: number
) {
  for (const det of dets) {
    if (det.classId === SFC_PERSON) continue
    const box = 'smoothBox' in det ? det.smoothBox : det.box
    const color = CLASS_COLORS[det.classId] ?? '#ffffff'
    const x  = box[0] * cw
    const y  = box[1] * ch
    const bw = (box[2] - box[0]) * cw
    const bh = (box[3] - box[1]) * ch

    // Expanded zone ring for plants and wildlife (the two violation targets)
    if (det.classId === SFC_PLANT || det.classId === SFC_WILDLIFE) {
      const pad = det.classId === SFC_WILDLIFE ? 0.15 : 0.12
      const ex = Math.max(0, box[0]-pad) * cw
      const ey = Math.max(0, box[1]-pad) * ch
      const ew = (Math.min(1, box[2]+pad) - Math.max(0, box[0]-pad)) * cw
      const eh = (Math.min(1, box[3]+pad) - Math.max(0, box[1]-pad)) * ch
      ctx.strokeStyle = color
      ctx.lineWidth   = 1
      ctx.globalAlpha = 0.35
      ctx.setLineDash([4, 4])
      ctx.strokeRect(ex, ey, ew, eh)
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }

    ctx.strokeStyle = color
    ctx.lineWidth   = 2
    ctx.strokeRect(x, y, bw, bh)

    // Label pill — use cocoLabel for richer display if available
    const displayName = (det as any).cocoLabel ?? CLASS_LABELS[det.classId] ?? `class_${det.classId}`
    const label  = `${displayName} ${(det.confidence * 100).toFixed(0)}%`
    ctx.font      = 'bold 12px system-ui, sans-serif'
    const textW   = ctx.measureText(label).width
    const pillH   = 18
    const pillY   = y > pillH + 2 ? y - pillH - 2 : y + bh + 2
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(x, pillY, textW + 10, pillH, 4)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, x + 5, pillY + pillH - 4)
  }
}

// ── Draw MediaPipe hand skeleton ──────────────────────────────────────────────
function drawHandSkeleton(
  ctx:      CanvasRenderingContext2D,
  handLms:  { x: number; y: number }[][],
  cw:       number,
  ch:       number,
  poseLabel: string
) {
  for (const lm of handLms) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.lineWidth   = 1.5
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath()
      ctx.moveTo(lm[a].x * cw, lm[a].y * ch)
      ctx.lineTo(lm[b].x * cw, lm[b].y * ch)
      ctx.stroke()
    }

    for (let i = 0; i < lm.length; i++) {
      const px = lm[i].x * cw
      const py = lm[i].y * ch
      ctx.beginPath()
      ctx.arc(px, py, i === 0 ? 5 : 3, 0, Math.PI * 2)
      ctx.fillStyle = i === 0
        ? '#ffffff'
        : poseLabel === 'plucking' ? '#22c55e'
        : poseLabel === 'petting'  ? '#ef4444'
        : '#3b82f6'
      ctx.fill()
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MonitorPage() {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const rafRef     = useRef<number>(0)
  const frameCount = useRef(0)

  const [running,          setRunning]          = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [userId,           setUserId]           = useState<string | null>(null)
  const [tracks,           setTracks]           = useState<TrackOption[]>([])
  const [selectedTrackId,  setSelectedTrackId]  = useState<string>('')
  const [manualTpa,        setManualTpa]        = useState<string>('')
  const [fps,              setFps]              = useState(0)

  const captureCooldown = useRef(false)
  const fpsFrames       = useRef(0)
  const fpsTimer        = useRef(0)
  const smoothedRef     = useRef<SmoothedDetection[]>([])
  const prevRawRef      = useRef<Detection[]>([])

  const { showToast, toastEl } = useToast()

  const {
    nodeConnected,
    lastDistance,
    sensorAlert,
    sensorAlertRef,
    clearSensorAlert,
  } = useSensorNode()

  const {
    modelReady,
    detections,
    detectionsRef,
    handLmsRef,
    poseLabel,
    poseLabelRef,
    alert,
    clearAlert,
    sendFrame,
    runMediaPipe,
  } = useDetection(sensorAlertRef)

  // ── Load user + tracks ─────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: enrollments } = await supabase
        .from('guide_track_enrollments')
        .select('track_id, training_tracks(id, title, tpa_name)')
        .eq('guide_id', user.id)
        .eq('status', 'active')

      if (enrollments) {
        const opts: TrackOption[] = enrollments
          .filter((e: any) => e.training_tracks)
          .map((e: any) => ({
            id: e.training_tracks.id,
            title: e.training_tracks.title,
            tpa_name: e.training_tracks.tpa_name,
          }))
        setTracks(opts)
        if (opts.length === 1) setSelectedTrackId(opts[0].id)
      }
    })()
  }, [])

  // ── Auto-sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const cleanup = registerAutoSync()
    return () => { cleanup() }
  }, [])

  // ── renderOverlay for evidence pre-roll buffer ─────────────────────────────
  const renderOverlay = useCallback((
    ctx: CanvasRenderingContext2D,
    cw:  number,
    ch:  number
  ) => {
    drawDetections(ctx, smoothedRef.current.length > 0 ? smoothedRef.current : detectionsRef.current, cw, ch)
    drawHandSkeleton(ctx, handLmsRef.current, cw, ch, poseLabelRef.current)
  }, [detectionsRef, handLmsRef, poseLabel])

  // ── rAF render loop ────────────────────────────────────────────────────────
  const startRaf = useCallback(() => {
    const video   = videoRef.current!
    const overlay = overlayRef.current!
    const ctx     = overlay.getContext('2d')!

    const loop = (timestamp: number) => {
      fpsFrames.current++
      if (timestamp - fpsTimer.current >= 1000) {
        setFps(fpsFrames.current)
        fpsFrames.current = 0
        fpsTimer.current  = timestamp
      }

      ctx.clearRect(0, 0, overlay.width, overlay.height)

      const rawDets = detectionsRef.current
      if (rawDets !== prevRawRef.current) {
        prevRawRef.current = rawDets
        smoothedRef.current = matchDetections(smoothedRef.current, rawDets)
      }
      lerpBoxes(smoothedRef.current, LERP_SPEED)

      drawDetections(ctx, smoothedRef.current, overlay.width, overlay.height)
      drawHandSkeleton(ctx, handLmsRef.current, overlay.width, overlay.height, poseLabelRef.current)

      frameCount.current++
      if (frameCount.current % INFERENCE_EVERY === 0) {
        sendFrame(video)
      }

      runMediaPipe(video, timestamp)

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [detectionsRef, handLmsRef, poseLabel, sendFrame, runMediaPipe])

  const stopRaf = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
  }, [])

  // ── Session start / stop ───────────────────────────────────────────────────
  const effectiveTrackId = selectedTrackId || manualTpa.trim()

  async function startSession() {
    if (!effectiveTrackId) {
      showToast('Select or enter a TPA before starting', 'warning')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:      { ideal: 640 },
          height:     { ideal: 480 },
          facingMode: 'environment',
          frameRate:  { ideal: 30, min: 24 },
        },
      })

      const video = videoRef.current!
      video.srcObject = stream
      await video.play()

      video.addEventListener('loadedmetadata', () => {
        const overlay  = overlayRef.current!
        overlay.width  = video.videoWidth
        overlay.height = video.videoHeight
      }, { once: true })

      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          console.warn('[Camera] Video track ended unexpectedly')
          stopSession()
          showToast('Camera interrupted — session stopped', 'warning')
        }, { once: true })
      }

      frameCount.current = 0
      fpsFrames.current  = 0
      fpsTimer.current   = 0

      startPreRollBuffer(video, renderOverlay)
      setRunning(true)
      startRaf()
    } catch {
      setPermissionDenied(true)
    }
  }

  function stopSession() {
    stopRaf()
    stopPreRollBuffer()
    const stream = videoRef.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach(t => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null

    const overlay = overlayRef.current
    if (overlay) overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height)

    setRunning(false)
    setFps(0)
    if (navigator.onLine) syncNow()
  }

  // ── Evidence capture ───────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!alert || !videoRef.current || !userId || captureCooldown.current) return
    captureCooldown.current = true
    setTimeout(() => { captureCooldown.current = false }, 8_000)

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveTrackId)
      await captureEvidenceClip({
        detectionType:   alert.type,
        confidenceScore: alert.confidence,
        trackId:         isUuid ? effectiveTrackId : null,
        tpaLabel:        isUuid ? null : effectiveTrackId,
        guideId:         userId,
      })
      showToast('Evidence captured', 'info')
    } catch (err: any) {
      if (err?.message === 'Capture already in progress') {
        console.warn('Capture skipped — already in progress')
      } else {
        console.error('Capture failed:', err)
        showToast('Failed to capture evidence clip', 'error')
      }
    }
  }, [alert, userId, effectiveTrackId, showToast])

  useEffect(() => {
    if (alert) handleCapture()
  }, [alert, handleCapture])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex-1 flex flex-col bg-surface">

      {/* Violation alert overlay */}
      {alert && (
        <div className="fixed inset-0 z-50 bg-error/90 flex flex-col items-center justify-center gap-6 px-8">
          <span className="material-symbols-outlined text-on-error" style={{ fontSize: 64 }}>warning</span>
          <div className="text-center">
            <p className="text-3xl font-black uppercase tracking-tight text-on-error">
              Violation Detected
            </p>
            <p className="text-on-error/80 font-semibold mt-2 uppercase tracking-widest text-sm">
              {alert.type === 'hand_near_plant' ? 'Hand plucking plant' : 'Hand petting wildlife'}
              {' '}— {alert.source === 'sensor_and_pose'
                ? `Sensor + AI confirmed — ${(alert.confidence * 100).toFixed(0)}% confidence`
                : `AI detected — ${(alert.confidence * 100).toFixed(0)}% confidence`
              }
            </p>
            <p className="text-on-error/60 text-xs font-mono mt-1">{alert.timestamp}</p>
          </div>
          <button
            onClick={clearAlert}
            className="mt-2 h-12 px-8 bg-on-error text-error rounded-xl font-bold uppercase tracking-widest text-sm hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <header className="px-4 sm:px-6 py-3 sm:py-4 bg-surface-container border-b border-outline-variant/20">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/30 shrink-0">
            <span className="material-symbols-outlined text-primary-fixed text-lg sm:text-xl">videocam</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#1B3A24]">
              AI Monitoring
            </h1>
            <p className="text-sm text-[#64748b] mt-1">
              Conservation Enforcement
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          {running && (
            <div className="flex items-center gap-1.5 bg-surface-container-high rounded-full px-2.5 py-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                {fps} fps
              </span>
            </div>
          )}

          {running && poseLabel !== '' && (
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
              poseLabel === 'plucking' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              <span className="material-symbols-outlined text-sm">
                {poseLabel === 'plucking' ? 'local_florist' : 'pets'}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {poseLabel}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
              nodeConnected
                ? 'bg-green-100 text-green-800'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}>
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                nodeConnected ? 'bg-green-500 animate-pulse' : 'bg-outline'
              }`} />
              <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                {nodeConnected
                  ? `${lastDistance !== null ? `${lastDistance.toFixed(0)}cm` : 'Node'}`
                  : 'Sensor'
                }
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-surface-container-high rounded-full px-2.5 py-1">
              <div className={`w-2 h-2 rounded-full shrink-0 ${modelReady ? 'bg-tertiary animate-pulse' : 'bg-outline'}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant whitespace-nowrap">
                {modelReady ? 'Ready' : 'Loading…'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start px-3 sm:px-4 py-4 sm:py-6 gap-4 sm:gap-6 w-full lg:max-w-2xl lg:mx-auto">

        {/* TPA selector */}
        {!running && (
          <div className="w-full">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2 block px-1">
              Select TPA to monitor
            </label>
            {tracks.length === 0 ? (
              <div className="flex flex-col gap-2">
                <div className="w-full flex items-center gap-3 bg-surface-container rounded-xl px-4 py-3">
                  <span className="material-symbols-outlined text-outline text-base">badge</span>
                  <p className="text-sm font-medium text-on-surface-variant">
                    No active enrollments. Enter TPA name manually.
                  </p>
                </div>
                <input
                  type="text"
                  value={manualTpa}
                  onChange={e => setManualTpa(e.target.value)}
                  placeholder="e.g. Bako National Park"
                  className="w-full h-12 bg-surface-container-high text-on-surface rounded-xl px-4 font-medium text-sm border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-on-surface-variant/50"
                />
              </div>
            ) : (
              <select
                value={selectedTrackId}
                onChange={e => setSelectedTrackId(e.target.value)}
                className="w-full h-12 bg-surface-container-high text-on-surface rounded-xl px-4 font-medium text-sm border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Choose a TPA…</option>
                {tracks.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.tpa_name} — {t.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Camera + overlay */}
        <div className="w-full rounded-2xl overflow-hidden shadow-lg shadow-primary/10 bg-black relative">
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            className="w-full aspect-video object-cover"
          />
          <canvas
            ref={overlayRef}
            width={640}
            height={480}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-container-highest/80 backdrop-blur-sm">
              <span className="material-symbols-outlined text-outline" style={{ fontSize: 48 }}>videocam_off</span>
              <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Camera inactive</p>
            </div>
          )}

          {running && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-surface-container/80 backdrop-blur-sm rounded-full px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface">Live</span>
            </div>
          )}

          {/* Legend */}
          {running && (
            <div className="absolute bottom-3 right-3 flex flex-col gap-1 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2">
              {Object.entries(CLASS_COLORS).map(([id, color]) => (
                <div key={id} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                    {CLASS_LABELS[+id]}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-1 pt-1 border-t border-white/20">
                <div className="w-3 h-3 rounded-full bg-white/60" />
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">hand pose</span>
              </div>
            </div>
          )}
        </div>

        {/* Sensor alert banner */}
        {sensorAlert?.active && (
          <div className="w-full flex items-center gap-3 bg-amber-100 text-amber-800 rounded-xl px-4 py-3 animate-pulse">
            <span className="material-symbols-outlined text-base">sensors</span>
            <div>
              <p className="text-sm font-bold uppercase tracking-widest">
                {sensorAlert.type === 'plant_intrusion'
                  ? `Plant proximity alert — ${sensorAlert.distance.toFixed(0)}cm`
                  : 'Motion detected in zone'
                }
              </p>
              <p className="text-xs opacity-70">
                {sensorAlert.type === 'plant_intrusion'
                  ? 'Object within 20cm of protected specimen'
                  : 'Movement detected near protected area'
                }
              </p>
            </div>
          </div>
        )}

        {permissionDenied && (
          <div className="w-full flex items-start gap-3 bg-error-container/70 text-on-error-container rounded-xl px-4 py-3 text-sm font-medium">
            <span className="material-symbols-outlined text-base mt-0.5">error</span>
            Camera access denied. Allow camera permission in browser settings.
          </div>
        )}

        {/* Controls */}
        <div className="w-full flex gap-3">
          {!running ? (
            <button
              onClick={startSession}
              disabled={!modelReady}
              className="flex-1 h-12 sm:h-14 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-xs sm:text-sm hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {!modelReady
                ? <span className="material-symbols-outlined animate-spin">progress_activity</span>
                : <><span className="material-symbols-outlined text-xl">play_arrow</span>Start monitoring</>
              }
            </button>
          ) : (
            <button
              onClick={stopSession}
              className="flex-1 h-12 sm:h-14 bg-error-container text-on-error-container rounded-xl font-bold uppercase tracking-widest text-xs sm:text-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">stop</span>
              Stop session
            </button>
          )}
        </div>

        {/* Clip queue */}
        <ClipQueuePanel />

        {/* Live detections */}
        {running && detections.length > 0 && (
          <div className="w-full">
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2 px-1">
              Detected objects
            </p>
            <div className="flex flex-wrap gap-2">
              {detections.filter(d => d.classId !== SFC_PERSON).map((d, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${CLASS_PILL_STYLES[d.classId] ?? 'bg-surface-container-high text-on-surface-variant'}`}
                >
                  <span className="material-symbols-outlined text-sm">{CLASS_ICONS[d.classId] ?? 'help'}</span>
                  {(d as any).cocoLabel ?? d.label} {(d.confidence * 100).toFixed(0)}%
                </div>
              ))}
            </div>
          </div>
        )}

        {running && detections.length === 0 && modelReady && (
          <div className="w-full flex items-center gap-3 bg-surface-container rounded-xl px-4 py-3">
            <span className="material-symbols-outlined text-outline text-base">search</span>
            <p className="text-sm font-medium text-on-surface-variant">Scanning — no objects detected</p>
          </div>
        )}

        {/* Info card */}
        <div className="w-full bg-surface-container-low rounded-2xl p-5 flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">
            Monitored violations
          </p>
          {[
            { icon: 'local_florist', label: 'Plucking protected plants' },
            { icon: 'pets',          label: 'Petting or handling wildlife' },
            { icon: 'no_photography', label: 'Proximity to restricted zones' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-tertiary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-on-tertiary-container text-base">{icon}</span>
              </div>
              <p className="text-sm font-medium text-on-surface">{label}</p>
            </div>
          ))}
        </div>

      </main>

      <footer className="py-4 text-center">
        <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-[0.3em]">
          © 2024 Sarawak Forestry Corporation. Guardians of Biodiversity.
        </p>
      </footer>

      {toastEl}
    </div>
  )
}
