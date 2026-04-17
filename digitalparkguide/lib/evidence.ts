import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function captureAndUploadEvidence(canvas: HTMLCanvasElement, alert: any) {
  // Capture canvas frame as JPEG blob (no FFmpeg.wasm needed for Path A)
  const blob = await new Promise<Blob>((res) =>
    canvas.toBlob((b) => res(b!), 'image/jpeg', 0.85)
  )

  const filename = `evidence/${alert.timestamp.replace(/[:.]/g, '-')}.jpg`
  const metadata = {
    guide_id: 'demo-guide',  // replace with actual auth user id
    activity_type: alert.targetBox.label,
    confidence: alert.confidence,
    timestamp: alert.timestamp,
    clip_url: '',
  }

  if (!navigator.onLine) {
    // Queue for later — store in localStorage for now, IndexedDB for production
    const queue = JSON.parse(localStorage.getItem('evidence_queue') || '[]')
    queue.push({ filename, blob: await blob.arrayBuffer(), metadata })
    localStorage.setItem('evidence_queue', JSON.stringify(queue))
    return
  }

  const { data, error } = await supabase.storage
    .from('evidence')
    .upload(filename, blob, { contentType: 'image/jpeg' })

  if (error) { console.error('Upload failed:', error); return }

  metadata.clip_url = data.path
  await supabase.from('evidence_logs').insert(metadata)
}