import { enqueueClip, type LocalEvidenceClip } from './evidenceQueue'

const SEGMENT_MS    = 6000  // 6-second pre-roll segments
const POST_ROLL_MS  = 5000  // 5-second post-roll after violation

const CODEC_PRIORITY = [
  { mime: 'video/webm; codecs="vp9, opus"', ext: '.webm' },
  { mime: 'video/webm; codecs="vp8, opus"', ext: '.webm' },
  { mime: 'video/webm', ext: '.webm' },
  { mime: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"', ext: '.mp4' },
]

// ── Composite canvas state ──────────────────────────────────────────────────
let compCanvas: HTMLCanvasElement | null = null
let compCtx: CanvasRenderingContext2D | null = null
let savedVideoEl: HTMLVideoElement | null = null
let savedOverlayFn: ((ctx: CanvasRenderingContext2D, w: number, h: number) => void) | null = null
let compositeInterval: ReturnType<typeof setInterval> | null = null
let recordStream: MediaStream | null = null
let selectedMime = ''
let selectedExt = ''

// ── Pre-roll cycling state ──────────────────────────────────────────────────
interface SegmentState {
  recorder: MediaRecorder
  chunks: Blob[]
  startTime: number
}

let activeSegment: SegmentState | null = null
let lastCompletedBlob: Blob | null = null
let lastCompletedDuration = 0
let segmentTimer: ReturnType<typeof setInterval> | null = null

// ── Session tracking ────────────────────────────────────────────────────────
let currentSessionId = ''
let capturing = false

function pickCodec(): { mime: string; ext: string } | null {
  for (const c of CODEC_PRIORITY) {
    if (MediaRecorder.isTypeSupported(c.mime)) return c
  }
  return null
}

function baseMime(): string {
  return (selectedMime || 'video/webm').split(';')[0].trim()
}

// ── Start a new pre-roll segment ────────────────────────────────────────────
function startSegment() {
  if (!recordStream) return

  const chunks: Blob[] = []
  const recorder = new MediaRecorder(recordStream, { mimeType: selectedMime })
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  recorder.start(1000)

  activeSegment = { recorder, chunks, startTime: Date.now() }
}

// ── Cycle: stop current segment, save blob, start new ───────────────────────
function cycleSegment() {
  if (!activeSegment || activeSegment.recorder.state !== 'recording') return

  const old = activeSegment
  const mime = baseMime()

  startSegment()

  old.recorder.onstop = () => {
    if (old.chunks.length > 0) {
      lastCompletedBlob = new Blob(old.chunks, { type: mime })
      lastCompletedDuration = Math.round((Date.now() - old.startTime) / 1000)
    }
  }
  old.recorder.stop()
}

// ── Public API ──────────────────────────────────────────────────────────────

export function startPreRollBuffer(
  videoEl: HTMLVideoElement,
  renderOverlay: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): void {
  stopPreRollBuffer()

  const codec = pickCodec()
  if (!codec) {
    console.error('No supported video codec found for MediaRecorder')
    return
  }
  selectedMime = codec.mime
  selectedExt = codec.ext

  const w = videoEl.videoWidth || 640
  const h = videoEl.videoHeight || 480

  savedVideoEl = videoEl
  savedOverlayFn = renderOverlay

  compCanvas = document.createElement('canvas')
  compCanvas.width = w
  compCanvas.height = h
  compCtx = compCanvas.getContext('2d')!
  compCtx.drawImage(videoEl, 0, 0, w, h)
  renderOverlay(compCtx, w, h)

  recordStream = typeof compCanvas.captureStream === 'function'
    ? compCanvas.captureStream(15)
    : videoEl.srcObject as MediaStream

  compositeInterval = setInterval(() => {
    if (!compCtx || !savedVideoEl) return
    compCtx.drawImage(savedVideoEl, 0, 0, w, h)
    if (savedOverlayFn) savedOverlayFn(compCtx, w, h)
  }, 66)

  currentSessionId = crypto.randomUUID()

  startSegment()
  segmentTimer = setInterval(cycleSegment, SEGMENT_MS)
}

export function stopPreRollBuffer(): void {
  if (segmentTimer !== null) { clearInterval(segmentTimer); segmentTimer = null }
  if (activeSegment?.recorder.state === 'recording') activeSegment.recorder.stop()
  activeSegment = null
  lastCompletedBlob = null
  lastCompletedDuration = 0

  if (compositeInterval !== null) { clearInterval(compositeInterval); compositeInterval = null }
  compCanvas = null
  compCtx = null
  savedVideoEl = null
  savedOverlayFn = null
  recordStream = null
  capturing = false
}

export async function captureEvidenceClip(
  metadata: {
    detectionType: string
    confidenceScore: number
    trackId: string | null
    tpaLabel: string | null
    guideId: string
  }
): Promise<LocalEvidenceClip> {
  if (!recordStream || !compCanvas) throw new Error('Recording not active')
  if (capturing) throw new Error('Capture already in progress')

  capturing = true
  try {
    return await _doCapture(metadata)
  } finally {
    capturing = false
  }
}

async function _doCapture(
  metadata: {
    detectionType: string
    confidenceScore: number
    trackId: string | null
    tpaLabel: string | null
    guideId: string
  }
): Promise<LocalEvidenceClip> {
  const mime = baseMime()

  // ── 1. Grab pre-roll from last completed segment (non-destructive) ────────
  const preRollParts: Blob[] = []
  let preRollDuration = 0

  if (lastCompletedBlob) {
    preRollParts.push(lastCompletedBlob)
    preRollDuration = lastCompletedDuration
  } else if (activeSegment?.recorder.state === 'recording') {
    activeSegment.recorder.requestData()
    await new Promise(r => setTimeout(r, 60))
    if (activeSegment.chunks.length > 0) {
      preRollParts.push(new Blob([...activeSegment.chunks], { type: mime }))
      preRollDuration = Math.round((Date.now() - activeSegment.startTime) / 1000)
    }
  }

  // ── 2. Start post-roll IMMEDIATELY (captures the violation moment) ────────
  const postChunks: Blob[] = []
  const postRecorder = new MediaRecorder(recordStream!, { mimeType: selectedMime })
  postRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) postChunks.push(e.data)
  }
  const postDone = new Promise<void>(r => { postRecorder.onstop = () => r() })
  postRecorder.start(1000)

  // ── 3. Thumbnail ──────────────────────────────────────────────────────────
  const thumbnailBlob = await extractThumbnail(compCanvas!)

  // ── 4. Wait for post-roll to finish ───────────────────────────────────────
  await new Promise(r => setTimeout(r, POST_ROLL_MS))
  postRecorder.stop()
  await postDone

  const postRollBlob = new Blob(postChunks, { type: mime })
  const postRollDuration = Math.round(POST_ROLL_MS / 1000)

  // ── 5. Merge pre-roll + post-roll into single blob ────────────────────────
  const mergedBlob = new Blob([...preRollParts, postRollBlob], { type: mime })
  const totalDuration = preRollDuration + postRollDuration

  // ── 6. Enqueue ────────────────────────────────────────────────────────────
  const localQueueId = crypto.randomUUID()

  const clip: LocalEvidenceClip = {
    localQueueId,
    clipBlob: mergedBlob,
    thumbnailBlob,
    mimeType: mime,
    detectedAt: new Date().toISOString(),
    durationSeconds: totalDuration,
    detectionType: metadata.detectionType,
    confidenceScore: metadata.confidenceScore,
    trackId: metadata.trackId,
    tpaLabel: metadata.tpaLabel,
    guideId: metadata.guideId,
    sessionId: currentSessionId,
    syncStatus: 'pending',
    retryCount: 0,
  }

  await enqueueClip(clip)
  return clip
}

async function extractThumbnail(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) { resolve(blob); return }
        canvas.toBlob(
          (jpegBlob) => resolve(jpegBlob!),
          'image/jpeg',
          0.85
        )
      },
      'image/webp',
      0.85
    )
  })
}

export function getSelectedMimeExt() {
  return { mime: selectedMime, ext: selectedExt }
}

export function getCurrentSessionId() {
  return currentSessionId
}
