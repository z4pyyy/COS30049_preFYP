// HoD Announcements Management — full CRUD with rich blocks + attachments

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ThemedSelect from '@/components/ThemedSelect'

type Block =
  | { type: 'h1' | 'h2' | 'h3' | 'paragraph'; text: string }
  | { type: 'attachment'; name: string; url: string; path: string; size: number; mime: string }

interface Announcement {
  id: string
  title: string
  category: string
  published: boolean
  published_at: string | null
  created_at: string
  content: string
  blocks: Block[]
}

const CATEGORIES = ['GENERAL', 'TRAINING', 'OPERATIONS', 'ALERT'] as const

const EMPTY_DRAFT = {
  id: null as string | null,
  title: '',
  category: 'GENERAL' as string,
  blocks: [] as Block[],
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function AnnouncementsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => { fetchAnnouncements() }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  async function fetchAnnouncements() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login?next=/dashboard/hod/announcements')
      return
    }
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, category, published, published_at, created_at, content, blocks')
      .order('created_at', { ascending: false })
    if (error) {
      console.error(error)
      setToast({ msg: 'Failed to load announcements', ok: false })
    } else {
      setAnnouncements((data ?? []).map(a => ({ ...a, blocks: (a.blocks ?? []) as Block[] })))
    }
    setLoading(false)
  }

  function resetDraft() { setDraft(EMPTY_DRAFT) }

  function loadForEdit(a: Announcement) {
    setDraft({ id: a.id, title: a.title, category: a.category, blocks: a.blocks ?? [] })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function addBlock(block: Block) {
    setDraft(d => ({ ...d, blocks: [...d.blocks, block] }))
  }

  function updateBlock(index: number, patch: Partial<Block>) {
    setDraft(d => ({
      ...d,
      blocks: d.blocks.map((b, i) => i === index ? { ...b, ...patch } as Block : b),
    }))
  }

  function removeBlock(index: number) {
    setDraft(d => ({ ...d, blocks: d.blocks.filter((_, i) => i !== index) }))
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setDraft(d => {
      const target = index + direction
      if (target < 0 || target >= d.blocks.length) return d
      const next = [...d.blocks]
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...d, blocks: next }
    })
  }

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/announcements/upload', { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Upload failed')
      addBlock({ type: 'attachment', ...body.attachment })
    } catch (err) {
      console.error(err)
      setToast({ msg: err instanceof Error ? err.message : 'Upload failed', ok: false })
    } finally {
      setUploading(false)
    }
  }

  async function removeAttachmentFromStorage(path: string) {
    try {
      await fetch('/api/announcements/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
    } catch (err) {
      console.error('Storage cleanup failed', err)
    }
  }

  async function save(publish: boolean) {
    if (!draft.title.trim()) {
      setToast({ msg: 'Title is required', ok: false })
      return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const payload: Record<string, unknown> = {
        title: draft.title.trim(),
        category: draft.category,
        blocks: draft.blocks,
        content: draft.blocks
          .map(b => b.type === 'attachment' ? `[${b.name}]` : b.text)
          .filter(Boolean)
          .join('\n\n'),
        published: publish,
        published_at: publish ? new Date().toISOString() : null,
      }

      if (draft.id) {
        const { error } = await supabase
          .from('announcements')
          .update(payload)
          .eq('id', draft.id)
        if (error) throw error
      } else {
        payload.created_by = user.id
        const { error } = await supabase.from('announcements').insert(payload)
        if (error) throw error
      }

      setToast({ msg: draft.id ? 'Saved' : publish ? 'Published' : 'Draft saved', ok: true })
      resetDraft()
      await fetchAnnouncements()
    } catch (err) {
      console.error(err)
      setToast({ msg: err instanceof Error ? err.message : 'Save failed', ok: false })
    } finally {
      setSaving(false)
    }
  }

  async function togglePublish(a: Announcement) {
    const next = !a.published
    const { error } = await supabase
      .from('announcements')
      .update({
        published: next,
        published_at: next ? new Date().toISOString() : null,
      })
      .eq('id', a.id)
    if (error) {
      console.error(error)
      setToast({ msg: 'Status update failed', ok: false })
    } else {
      setToast({ msg: next ? 'Published' : 'Unpublished', ok: true })
      fetchAnnouncements()
    }
  }

  async function deleteAnnouncement(a: Announcement) {
    if (!confirm(`Delete "${a.title}"? Attachments will also be removed.`)) return

    const paths = (a.blocks ?? [])
      .filter((b): b is Extract<Block, { type: 'attachment' }> => b.type === 'attachment')
      .map(b => b.path)

    const { error } = await supabase.from('announcements').delete().eq('id', a.id)
    if (error) {
      console.error(error)
      setToast({ msg: 'Delete failed', ok: false })
      return
    }
    await Promise.all(paths.map(removeAttachmentFromStorage))
    setToast({ msg: 'Deleted', ok: true })
    if (draft.id === a.id) resetDraft()
    fetchAnnouncements()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <span className="material-symbols-outlined animate-spin text-3xl text-[#2D6A3F]">progress_activity</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white ${toast.ok ? 'bg-emerald-700' : 'bg-red-700'}`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1B3A24] mb-2">Platform Announcements</h1>
          <p className="text-[#64748b]">Compose rich announcements with headings and attachments. Drafts stay private until published.</p>
        </div>

        {/* Editor */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-[#e2e8f0] mb-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-[#1B3A24]">
              {draft.id ? 'Edit announcement' : 'New announcement'}
            </h2>
            {draft.id && (
              <button onClick={resetDraft} className="text-sm text-[#64748b] hover:text-[#1B3A24] underline">
                Cancel edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-3 mb-5">
            <input
              type="text"
              value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder="Announcement title"
              className="px-4 py-2.5 border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D6A3F] text-lg font-semibold"
            />
            <ThemedSelect
              value={draft.category}
              onChange={v => setDraft(d => ({ ...d, category: v }))}
              options={CATEGORIES.map(c => ({ value: c, label: c }))}
            />
          </div>

          {/* Block toolbar */}
          <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-[#e2e8f0]">
            {(['h1', 'h2', 'h3'] as const).map(lvl => (
              <button
                key={lvl}
                onClick={() => addBlock({ type: lvl, text: '' })}
                className="px-3 py-1.5 text-sm font-medium border border-[#cbd5e1] rounded-lg hover:bg-[#f1f5f9] text-[#1B3A24]"
              >
                + Heading {lvl.toUpperCase()}
              </button>
            ))}
            <button
              onClick={() => addBlock({ type: 'paragraph', text: '' })}
              className="px-3 py-1.5 text-sm font-medium border border-[#cbd5e1] rounded-lg hover:bg-[#f1f5f9] text-[#1B3A24]"
            >
              + Paragraph
            </button>
            <label className={`px-3 py-1.5 text-sm font-medium border border-[#cbd5e1] rounded-lg cursor-pointer text-[#1B3A24] ${uploading ? 'opacity-50' : 'hover:bg-[#f1f5f9]'}`}>
              {uploading ? 'Uploading…' : '+ Attachment'}
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleUpload(f)
                  e.target.value = ''
                }}
              />
            </label>
          </div>

          {/* Block list */}
          {draft.blocks.length === 0 ? (
            <p className="text-sm text-[#94a3b8] italic py-6 text-center">No content yet — use the buttons above to add headings, paragraphs, or attachments.</p>
          ) : (
            <div className="space-y-3">
              {draft.blocks.map((b, i) => (
                <div key={i} className="flex items-start gap-2 group">
                  <div className="flex flex-col gap-1 pt-2">
                    <button onClick={() => moveBlock(i, -1)} disabled={i === 0}
                      className="text-[#94a3b8] hover:text-[#1B3A24] disabled:opacity-30">
                      <span className="material-symbols-outlined text-base">arrow_upward</span>
                    </button>
                    <button onClick={() => moveBlock(i, 1)} disabled={i === draft.blocks.length - 1}
                      className="text-[#94a3b8] hover:text-[#1B3A24] disabled:opacity-30">
                      <span className="material-symbols-outlined text-base">arrow_downward</span>
                    </button>
                  </div>

                  <div className="flex-1">
                    {b.type === 'attachment' ? (
                      <div className="px-4 py-3 border border-[#e2e8f0] rounded-lg bg-[#f8fafc] space-y-3">
                        {b.mime.startsWith('image/') && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.url} alt={b.name}
                            className="max-h-64 rounded-md border border-[#e2e8f0] object-contain bg-white" />
                        )}
                        {b.mime.startsWith('video/') && (
                          <video src={b.url} controls className="max-h-64 w-full rounded-md bg-black" />
                        )}
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-[#2D6A3F]">attach_file</span>
                          <div className="flex-1 min-w-0">
                            <a href={b.url} target="_blank" rel="noopener noreferrer"
                              className="font-medium text-[#1B3A24] truncate block hover:underline">
                              {b.name}
                            </a>
                            <p className="text-xs text-[#64748b]">{b.mime} · {formatBytes(b.size)}</p>
                          </div>
                        </div>
                      </div>
                    ) : b.type === 'paragraph' ? (
                      <textarea
                        value={b.text}
                        onChange={e => updateBlock(i, { text: e.target.value })}
                        placeholder="Paragraph text…"
                        rows={3}
                        className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D6A3F] resize-y"
                      />
                    ) : (
                      <input
                        type="text"
                        value={b.text}
                        onChange={e => updateBlock(i, { text: e.target.value })}
                        placeholder={`Heading ${b.type.toUpperCase()}…`}
                        className={`w-full px-3 py-2 border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D6A3F] ${
                          b.type === 'h1' ? 'text-2xl font-bold' : b.type === 'h2' ? 'text-xl font-bold' : 'text-lg font-semibold'
                        } text-[#1B3A24]`}
                      />
                    )}
                  </div>

                  <button
                    onClick={async () => {
                      if (b.type === 'attachment') await removeAttachmentFromStorage(b.path)
                      removeBlock(i)
                    }}
                    className="pt-2 text-[#94a3b8] hover:text-red-600"
                    title="Remove block"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => save(true)}
              disabled={saving || !draft.title.trim()}
              className="px-5 py-2 bg-[#2D6A3F] text-white font-medium rounded-lg hover:bg-[#1B3A24] disabled:opacity-50"
            >
              {saving ? 'Saving…' : draft.id ? 'Save & Publish' : 'Publish'}
            </button>
            <button
              onClick={() => save(false)}
              disabled={saving || !draft.title.trim()}
              className="px-5 py-2 border border-[#cbd5e1] text-[#1B3A24] font-medium rounded-lg hover:bg-[#f1f5f9] disabled:opacity-50"
            >
              Save as draft
            </button>
          </div>
        </section>

        {/* List */}
        <h2 className="text-lg font-semibold text-[#1B3A24] mb-4">Published & drafts</h2>
        {announcements.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-[#e2e8f0]">
            <div className="text-4xl mb-3">📢</div>
            <p className="text-[#64748b]">No announcements yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map(a => {
              const attachCount = (a.blocks ?? []).filter(b => b.type === 'attachment').length
              return (
                <div
                  key={a.id}
                  className="bg-white rounded-xl p-5 shadow-sm border border-[#e2e8f0] hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#1B3A24] text-lg truncate">{a.title}</h3>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">{a.category}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${a.published ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {a.published ? 'Published' : '⊝ Draft'}
                        </span>
                        {attachCount > 0 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                            📎 {attachCount} attachment{attachCount === 1 ? '' : 's'}
                          </span>
                        )}
                        <span className="text-xs text-[#64748b]">
                          {new Date(a.published_at ?? a.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => loadForEdit(a)}
                        className="px-3 py-1.5 text-sm border border-[#cbd5e1] rounded-lg text-[#1B3A24] hover:bg-[#f1f5f9]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => togglePublish(a)}
                        className="px-3 py-1.5 text-sm border border-[#cbd5e1] rounded-lg text-[#1B3A24] hover:bg-[#f1f5f9]"
                      >
                        {a.published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => deleteAnnouncement(a)}
                        className="px-3 py-1.5 text-sm border border-red-200 rounded-lg text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
