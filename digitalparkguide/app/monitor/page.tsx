'use client'

import { useEffect, useRef, useState } from 'react'
import { useDetection } from '@/lib/useDetection'
import { captureAndUploadEvidence } from '@/lib/evidence'
import TopNavClient from '@/components/TopNavClient'

export default function MonitorPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const loopRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const { modelReady, detections, alert, clearAlert, runInference } = useDetection(canvasRef)

  const CLASS_COLORS: Record<number, string> = {
    0: '#22c55e',   // flower — green
    1: '#3b82f6',   // hand — blue
    2: '#f97316',   // person — orange
    3: '#ef4444',   // wildlife — red
  }

  async function startSession() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'environment' },
      })
      videoRef.current!.srcObject = stream
      await videoRef.current!.play()
      setRunning(true)
    } catch {
      setPermissionDenied(true)
    }
  }

  function stopSession() {
    clearTimeout(loopRef.current)
    const stream = videoRef.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach((t) => t.stop())
    setRunning(false)
    // clear overlay
    const overlay = overlayRef.current
    if (overlay) {
      const ctx = overlay.getContext('2d')!
      ctx.clearRect(0, 0, overlay.width, overlay.height)
    }
  }

  

  useEffect(() => {
  if (!running || !modelReady) return
  const canvas = canvasRef.current!
  const video = videoRef.current!
  const overlay = overlayRef.current!
  const inferenceCtx = canvas.getContext('2d')!
  const overlayCtx = overlay.getContext('2d')!

  const CLASS_COLORS: Record<number, string> = {
    0: '#22c55e',
    1: '#3b82f6',
    2: '#f97316',
    3: '#ef4444',
  }

  const CLASS_LABELS: Record<number, string> = {
    0: 'flower', 1: 'hand', 2: 'person', 3: 'wildlife'
  }

  let cancelled = false

  async function loop() {
    if (cancelled) return

    inferenceCtx.drawImage(video, 0, 0, 640, 640)
    const dets = await runInference()

    overlayCtx.clearRect(0, 0, overlay.width, overlay.height)

    if (dets) {
      for (const det of dets) {
        const color = CLASS_COLORS[det.classId] ?? '#ffffff'
        const x = det.box[0] * overlay.width
        const y = det.box[1] * overlay.height
        const w = (det.box[2] - det.box[0]) * overlay.width
        const h = (det.box[3] - det.box[1]) * overlay.height

        // Dashed expanded alert zone for wildlife and flower
        if (det.classId === 0 || det.classId === 3) {
          const padding = 0.15
          const ex = Math.max(0, det.box[0] - padding) * overlay.width
          const ey = Math.max(0, det.box[1] - padding) * overlay.height
          const ew = (Math.min(1, det.box[2] + padding) - Math.max(0, det.box[0] - padding)) * overlay.width
          const eh = (Math.min(1, det.box[3] + padding) - Math.max(0, det.box[1] - padding)) * overlay.height
          overlayCtx.strokeStyle = color
          overlayCtx.lineWidth = 1
          overlayCtx.setLineDash([4, 4])
          overlayCtx.strokeRect(ex, ey, ew, eh)
          overlayCtx.setLineDash([])
        }

        // Solid box
        overlayCtx.strokeStyle = color
        overlayCtx.lineWidth = 2
        overlayCtx.strokeRect(x, y, w, h)

        // Label background
        const label = `${CLASS_LABELS[det.classId]} ${(det.confidence * 100).toFixed(0)}%`
        overlayCtx.font = 'bold 13px sans-serif'
        const textWidth = overlayCtx.measureText(label).width
        overlayCtx.fillStyle = color
        overlayCtx.fillRect(x, y - 20, textWidth + 8, 20)

        // Label text
        overlayCtx.fillStyle = '#ffffff'
        overlayCtx.fillText(label, x + 4, y - 5)
      }
    }

    if (!cancelled) loopRef.current = setTimeout(loop, 100)
  }

  loop()
  return () => {
    cancelled = true
    clearTimeout(loopRef.current)
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height)
  }
}, [running, modelReady])

  useEffect(() => {
    if (!alert || !canvasRef.current) return
    captureAndUploadEvidence(canvasRef.current, alert)
  }, [alert])

  function pillStyle(classId: number) {
    if (classId === 0) return 'bg-green-100 text-green-800'
    if (classId === 1) return 'bg-blue-100 text-blue-800'
    if (classId === 2) return 'bg-surface-container-high text-on-surface-variant'
    return 'bg-tertiary-container text-on-tertiary-container'
  }

  function pillIcon(classId: number) {
    if (classId === 0) return 'local_florist'
    if (classId === 1) return 'back_hand'
    if (classId === 2) return 'person'
    return 'pets'
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-surface">
      <TopNavClient />

      {/* Alert overlay */}
      {alert && (
        <div className="fixed inset-0 z-50 bg-error/90 flex flex-col items-center justify-center gap-6 px-8">
          <span className="material-symbols-outlined text-on-error" style={{ fontSize: 64 }}>warning</span>
          <div className="text-center">
            <p className="text-3xl font-black uppercase tracking-tight text-on-error">
              Violation Detected
            </p>
            <p className="text-on-error/80 font-semibold mt-2 uppercase tracking-widest text-sm">
              Hand near {alert.targetBox.label} — {(alert.confidence * 100).toFixed(0)}% confidence
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
      <header className="flex items-center gap-4 px-6 py-4 bg-surface-container border-b border-outline-variant/20">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/30">
          <span className="material-symbols-outlined text-primary-fixed text-xl">videocam</span>
        </div>
        <div>
          <h1 className="text-base font-black uppercase tracking-tight text-on-surface leading-none">
            AI Monitoring
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mt-0.5">
            Conservation Enforcement
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 bg-surface-container-high rounded-full px-3 py-1.5">
          <div className={`w-2 h-2 rounded-full ${modelReady ? 'bg-tertiary animate-pulse' : 'bg-outline'}`} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            {modelReady ? 'Model ready' : 'Loading model…'}
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start px-4 py-6 gap-6 max-w-2xl mx-auto w-full">

        {/* Camera feed with bounding box overlay */}
        <div className="w-full rounded-2xl overflow-hidden shadow-lg shadow-primary/10 bg-black relative">
          {/* Hidden inference canvas */}
          <canvas ref={canvasRef} width={640} height={640} className="hidden" />

          {/* Video feed */}
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full aspect-video object-cover"
          />

          {/* Bounding box overlay — sits exactly on top of video */}
          <canvas
            ref={overlayRef}
            width={640}
            height={480}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Idle overlay */}
          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-container-highest/80 backdrop-blur-sm">
              <span className="material-symbols-outlined text-outline" style={{ fontSize: 48 }}>videocam_off</span>
              <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Camera inactive</p>
            </div>
          )}

          {/* Live indicator */}
          {running && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-surface-container/80 backdrop-blur-sm rounded-full px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface">Live</span>
            </div>
          )}

          {/* Legend */}
          {running && (
            <div className="absolute bottom-3 right-3 flex flex-col gap-1 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2">
              {[
                { color: '#22c55e', label: 'Flower' },
                { color: '#3b82f6', label: 'Hand' },
                { color: '#f97316', label: 'Person' },
                { color: '#ef4444', label: 'Wildlife' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {permissionDenied && (
          <div className="w-full flex items-start gap-3 bg-error-container/70 text-on-error-container rounded-xl px-4 py-3 text-sm font-medium">
            <span className="material-symbols-outlined text-base mt-0.5">error</span>
            Camera access was denied. Please allow camera permission in your browser settings.
          </div>
        )}

        {/* Controls */}
        <div className="w-full flex gap-3">
          {!running ? (
            <button
              onClick={startSession}
              disabled={!modelReady}
              className="flex-1 h-14 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {!modelReady
                ? <span className="material-symbols-outlined animate-spin">progress_activity</span>
                : <><span className="material-symbols-outlined text-xl">play_arrow</span>Start monitoring</>
              }
            </button>
          ) : (
            <button
              onClick={stopSession}
              className="flex-1 h-14 bg-error-container text-on-error-container rounded-xl font-bold uppercase tracking-widest text-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">stop</span>
              Stop session
            </button>
          )}
        </div>

        {/* Live detections */}
        {running && detections.length > 0 && (
          <div className="w-full">
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2 px-1">
              Detected objects
            </p>
            <div className="flex flex-wrap gap-2">
              {detections.map((d, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${pillStyle(d.classId)}`}
                >
                  <span className="material-symbols-outlined text-sm">{pillIcon(d.classId)}</span>
                  {d.label} {(d.confidence * 100).toFixed(0)}%
                </div>
              ))}
            </div>
          </div>
        )}

        {running && detections.length === 0 && modelReady && (
          <div className="w-full flex items-center gap-3 bg-surface-container rounded-xl px-4 py-3">
            <span className="material-symbols-outlined text-outline text-base">search</span>
            <p className="text-sm font-medium text-on-surface-variant">Scanning — no objects detected yet</p>
          </div>
        )}

        {/* Info card */}
        <div className="w-full bg-surface-container-low rounded-2xl p-5 flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">
            Monitored violations
          </p>
          {[
            { icon: 'local_florist', label: 'Handling protected plants' },
            { icon: 'pets', label: 'Disturbing wildlife' },
            { icon: 'no_photography', label: 'Proximity to restricted objects' },
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
    </div>
  )
}