'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useDetection } from '@/lib/useDetection'
import { startPreRollBuffer, stopPreRollBuffer, captureEvidenceClip } from '@/lib/evidence'
import { syncNow, registerAutoSync } from '@/lib/evidenceSync'
import { getPendingCount, resetFailedClips } from '@/lib/evidenceQueue'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

interface TrackOption {
  id: string
  title: string
  tpa_name: string
}

export default function MonitorPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const loopRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const captureCooldownRef = useRef(false)
  const latestDetections = useRef<typeof detections>([])


  const [userId, setUserId] = useState<string | null>(null)
  const [tracks, setTracks] = useState<TrackOption[]>([])
  const [selectedTrackId, setSelectedTrackId] = useState<string>('')
  const [manualTpa, setManualTpa] = useState<string>('')
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const { showToast, toastEl } = useToast()
  const { modelReady, detections, alert, clearAlert, runInference } = useDetection(canvasRef)

  // Load user + enrolled tracks
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

  // Auto-sync registration + pending count polling
  useEffect(() => {
    const cleanup = registerAutoSync()
    const interval = setInterval(async () => {
      setPendingCount(await getPendingCount())
    }, 5000)
    return () => { cleanup(); clearInterval(interval) }
  }, [])

  const CLASS_COLORS: Record<number, string> = {
    0: '#22c55e',
    1: '#3b82f6',
    2: '#f97316',
    3: '#ef4444',
  }

  const CLASS_LABELS: Record<number, string> = {
    0: 'flower', 1: 'hand', 2: 'person', 3: 'wildlife',
  }

  async function handleManualSync() {
    if (syncing) return
    setSyncing(true)
    try {
      await resetFailedClips()
      await syncNow((done, total) => {
        setPendingCount(total - done)
      })
      const remaining = await getPendingCount()
      setPendingCount(remaining)
      if (remaining === 0) {
        showToast('All clips synced', 'info')
      } else {
        showToast(`${remaining} clip${remaining > 1 ? 's' : ''} still queued`, 'warning')
      }
    } catch (err) {
      console.error('Manual sync failed:', err)
      showToast('Sync failed — check connection', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const effectiveTrackId = selectedTrackId || manualTpa.trim()

  // Draws bounding boxes onto a canvas context — used by evidence recorder's composite loop
  function renderOverlay(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
    const dets = latestDetections.current
    for (const det of dets) {
      const color = CLASS_COLORS[det.classId] ?? '#ffffff'
      const x = det.box[0] * cw
      const y = det.box[1] * ch
      const bw = (det.box[2] - det.box[0]) * cw
      const bh = (det.box[3] - det.box[1]) * ch

      if (det.classId === 0 || det.classId === 3) {
        const padding = 0.15
        const ex = Math.max(0, det.box[0] - padding) * cw
        const ey = Math.max(0, det.box[1] - padding) * ch
        const ew = (Math.min(1, det.box[2] + padding) - Math.max(0, det.box[0] - padding)) * cw
        const eh = (Math.min(1, det.box[3] + padding) - Math.max(0, det.box[1] - padding)) * ch
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.strokeRect(ex, ey, ew, eh)
        ctx.setLineDash([])
      }

      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, bw, bh)

      const label = `${CLASS_LABELS[det.classId]} ${(det.confidence * 100).toFixed(0)}%`
      ctx.font = 'bold 13px sans-serif'
      const textWidth = ctx.measureText(label).width
      ctx.fillStyle = color
      ctx.fillRect(x, y - 20, textWidth + 8, 20)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, x + 4, y - 5)
    }
  }

  async function startSession() {
    if (!effectiveTrackId) {
      showToast('Select or enter a TPA before starting', 'warning')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'environment' },
      })
      videoRef.current!.srcObject = stream
      await videoRef.current!.play()
      startPreRollBuffer(videoRef.current!, renderOverlay)
      setRunning(true)
    } catch {
      setPermissionDenied(true)
    }
  }

  function stopSession() {
    clearTimeout(loopRef.current)
    stopPreRollBuffer()
    const stream = videoRef.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach((t) => t.stop())
    latestDetections.current = []
    setRunning(false)
    const overlay = overlayRef.current
    if (overlay) {
      const ctx = overlay.getContext('2d')!
      ctx.clearRect(0, 0, overlay.width, overlay.height)
    }
    if (navigator.onLine) syncNow()
  }

  // Evidence capture on alert — raw camera stream for smooth video, composite canvas for thumbnail with boxes
  const handleCapture = useCallback(async () => {
    if (!alert || !videoRef.current || !userId || captureCooldownRef.current) return

    captureCooldownRef.current = true
    setTimeout(() => { captureCooldownRef.current = false }, 25000)

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveTrackId)
      await captureEvidenceClip({
        detectionType: `hand_near_${alert.targetBox.label}`,
        confidenceScore: alert.confidence,
        trackId: isUuid ? effectiveTrackId : null,
        tpaLabel: isUuid ? null : effectiveTrackId,
        guideId: userId,
      })
      const count = await getPendingCount()
      setPendingCount(count)
      showToast(`Evidence clip captured — ${count} queued`, 'info')
    } catch (err) {
      console.error('Capture failed:', err)
      showToast('Failed to capture evidence clip', 'error')
    }
  }, [alert, userId, effectiveTrackId, showToast])

  useEffect(() => {
    if (alert) handleCapture()
  }, [alert, handleCapture])

  // Detection loop — runs inference at ~10fps, draws bounding boxes on overlay
  useEffect(() => {
    if (!running || !modelReady) return
    const canvas = canvasRef.current!
    const video = videoRef.current!
    const overlay = overlayRef.current!
    const inferenceCtx = canvas.getContext('2d')!
    const overlayCtx = overlay.getContext('2d')!

    let cancelled = false

    async function loop() {
      if (cancelled) return

      inferenceCtx.drawImage(video, 0, 0, 640, 640)
      const dets = await runInference()

      if (dets) latestDetections.current = dets

      overlayCtx.clearRect(0, 0, overlay.width, overlay.height)
      for (const det of latestDetections.current) {
        const color = CLASS_COLORS[det.classId] ?? '#ffffff'
        const x = det.box[0] * overlay.width
        const y = det.box[1] * overlay.height
        const w = (det.box[2] - det.box[0]) * overlay.width
        const h = (det.box[3] - det.box[1]) * overlay.height

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

        overlayCtx.strokeStyle = color
        overlayCtx.lineWidth = 2
        overlayCtx.strokeRect(x, y, w, h)

        const label = `${CLASS_LABELS[det.classId]} ${(det.confidence * 100).toFixed(0)}%`
        overlayCtx.font = 'bold 13px sans-serif'
        const textWidth = overlayCtx.measureText(label).width
        overlayCtx.fillStyle = color
        overlayCtx.fillRect(x, y - 20, textWidth + 8, 20)
        overlayCtx.fillStyle = '#ffffff'
        overlayCtx.fillText(label, x + 4, y - 5)
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
    <div className="relative flex-1 flex flex-col bg-surface">

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
        <div className="ml-auto flex items-center gap-3">
          {/* Sync button */}
          {pendingCount > 0 && (
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="flex items-center gap-1.5 bg-amber-100 text-amber-800 rounded-full px-3 py-1.5 hover:bg-amber-200 active:scale-95 transition-all disabled:opacity-70"
            >
              <span className={`material-symbols-outlined text-sm ${syncing ? 'animate-spin' : ''}`}>
                {syncing ? 'progress_activity' : 'cloud_upload'}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {syncing ? 'Syncing…' : `${pendingCount} queued · Sync`}
              </span>
            </button>
          )}
          <div className="flex items-center gap-2 bg-surface-container-high rounded-full px-3 py-1.5">
            <div className={`w-2 h-2 rounded-full ${modelReady ? 'bg-tertiary animate-pulse' : 'bg-outline'}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              {modelReady ? 'Model ready' : 'Loading model…'}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start px-4 py-6 gap-6 max-w-2xl mx-auto w-full">

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
                    No active badge enrollments found. Enter TPA name manually.
                  </p>
                </div>
                <input
                  type="text"
                  value={manualTpa}
                  onChange={(e) => setManualTpa(e.target.value)}
                  placeholder="Enter TPA name (e.g. Bako National Park)"
                  className="w-full h-12 bg-surface-container-high text-on-surface rounded-xl px-4 font-medium text-sm border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-on-surface-variant/50"
                />
              </div>
            ) : (
              <select
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value)}
                className="w-full h-12 bg-surface-container-high text-on-surface rounded-xl px-4 font-medium text-sm border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Choose a TPA…</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tpa_name} — {t.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Camera feed with bounding box overlay */}
        <div className="w-full rounded-2xl overflow-hidden shadow-lg shadow-primary/10 bg-black relative">
          <canvas ref={canvasRef} width={640} height={640} className="hidden" />
          <video
            ref={videoRef}
            muted
            playsInline
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

      {toastEl}
    </div>
  )
}
