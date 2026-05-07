import { enqueueClip, type LocalEvidenceClip } from './evidenceQueue'

const POST_ROLL_SECONDS = 10

const CODEC_PRIORITY = [
  { mime: 'video/webm; codecs="vp9, opus"', ext: '.webm' },
  { mime: 'video/webm; codecs="vp8, opus"', ext: '.webm' },
  { mime: 'video/webm', ext: '.webm' },
  { mime: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"', ext: '.mp4' },
]

let recorder: MediaRecorder | null = null
let chunks: Blob[] = []
let compositeInterval: ReturnType<typeof setInterval> | null = null
let compCanvas: HTMLCanvasElement | null = null
let compCtx: CanvasRenderingContext2D | null = null
let savedVideoEl: HTMLVideoElement | null = null
let savedOverlayFn: ((ctx: CanvasRenderingContext2D, w: number, h: number) => void) | null = null
let selectedMime = ''
let selectedExt = ''

function pickCodec(): { mime: string; ext: string } | null {
  for (const c of CODEC_PRIORITY) {
    if (MediaRecorder.isTypeSupported(c.mime)) return c
  }
  return null
}

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

  // Prime canvas with initial frame
  compCtx.drawImage(videoEl, 0, 0, w, h)
  renderOverlay(compCtx, w, h)

  // Composite stream from canvas — bounding boxes baked into video
  let recordStream: MediaStream
  if (typeof compCanvas.captureStream === 'function') {
    recordStream = compCanvas.captureStream(30)
  } else {
    recordStream = videoEl.srcObject as MediaStream
  }

  chunks = []
  recorder = new MediaRecorder(recordStream, { mimeType: codec.mime })
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  recorder.start(1000)

  compositeInterval = setInterval(() => {
    if (!compCtx || !savedVideoEl) return
    compCtx.drawImage(savedVideoEl, 0, 0, w, h)
    if (savedOverlayFn) savedOverlayFn(compCtx, w, h)
  }, 33)
}

export function stopPreRollBuffer(): void {
  if (compositeInterval !== null) {
    clearInterval(compositeInterval)
    compositeInterval = null
  }
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop()
  }
  recorder = null
  chunks = []
  compCanvas = null
  compCtx = null
  savedVideoEl = null
  savedOverlayFn = null
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
  const rec = recorder
  const canvas = compCanvas

  if (!rec || rec.state !== 'recording' || !canvas) {
    throw new Error('Recording not active')
  }

  const baseMime = (selectedMime || 'video/webm').split(';')[0].trim()

  // Thumbnail: snapshot current composite frame (has bounding boxes)
  const thumbnailBlob = await extractThumbnail(canvas)

  // Keep recording for post-roll
  await new Promise((r) => setTimeout(r, POST_ROLL_SECONDS * 1000))

  // Stop and collect complete recording (session start → post-roll end)
  const stopDone = new Promise<void>((resolve) => {
    rec.onstop = () => resolve()
  })
  rec.stop()
  await stopDone

  if (compositeInterval !== null) {
    clearInterval(compositeInterval)
    compositeInterval = null
  }

  const clipBlob = new Blob(chunks, { type: baseMime })
  const durationSeconds = chunks.length

  const localQueueId = crypto.randomUUID()

  const clip: LocalEvidenceClip = {
    localQueueId,
    clipBlob,
    thumbnailBlob,
    mimeType: baseMime,
    detectedAt: new Date().toISOString(),
    durationSeconds,
    detectionType: metadata.detectionType,
    confidenceScore: metadata.confidenceScore,
    trackId: metadata.trackId,
    tpaLabel: metadata.tpaLabel,
    guideId: metadata.guideId,
    syncStatus: 'pending',
    retryCount: 0,
  }

  await enqueueClip(clip)

  // Restart continuous recording for next detection
  const ve = savedVideoEl
  const fn = savedOverlayFn
  recorder = null
  chunks = []
  if (ve && fn) {
    startPreRollBuffer(ve, fn)
  }

  return clip
}

async function extractThumbnail(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }
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
