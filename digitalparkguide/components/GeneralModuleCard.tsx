'use client'

import { useState, useEffect } from 'react'

interface Props {
  module: {
    id: string
    title: string
    description: string
    content?: string
    duration_hours: number
    price_myr: number
    completed: boolean
    completed_at: string | null
    enrolled: boolean
    paid: boolean
    quiz_id: string | null
    required_by_tracks: Array<{ id: string; title: string }>
  }
}

export default function GeneralModuleCard({ module: mod }: Props) {
  const [loading, setLoading] = useState(false)
  const [completed, setCompleted] = useState(mod.completed)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  async function handleEnroll() {
    setLoading(true)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'general_module', moduleId: mod.id }),
    })
    if (res.ok) {
      const { url } = await res.json()
      window.location.href = url
    } else {
      setLoading(false)
    }
  }

  async function handleMarkComplete() {
    setLoading(true)
    const res = await fetch(`/api/general-modules/${mod.id}/complete`, { method: 'POST' })
    if (res.ok) {
      setCompleted(true)
    }
    setLoading(false)
  }

  let statusBadge: { label: string; bg: string; text: string; icon: string }
  if (completed) {
    statusBadge = {
      label: 'Completed',
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-700',
      icon: 'check_circle',
    }
  } else if (mod.enrolled && mod.paid) {
    statusBadge = {
      label: 'Enrolled',
      bg: 'bg-blue-50 border-blue-200',
      text: 'text-blue-700',
      icon: 'school',
    }
  } else {
    statusBadge = {
      label: 'Not Enrolled',
      bg: 'bg-[#f1f5f9] border-[#e2e8f0]',
      text: 'text-[#94a3b8]',
      icon: 'lock',
    }
  }

  const actionButtons = (
    <>
      {completed ? (
        <p className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">verified</span>
          Completed {mod.completed_at ? new Date(mod.completed_at).toLocaleDateString('en-MY', {
            day: 'numeric', month: 'short', year: 'numeric',
          }) : ''}
        </p>
      ) : mod.enrolled && mod.paid ? (
        mod.quiz_id ? (
          <a
            href={`/quiz?quiz_id=${mod.quiz_id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            <span className="material-symbols-outlined text-sm">quiz</span>
            Start Quiz
          </a>
        ) : (
          <button
            onClick={handleMarkComplete}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">
              {loading ? 'progress_activity' : 'check_circle'}
            </span>
            {loading ? 'Completing…' : 'Mark as Complete'}
          </button>
        )
      ) : (
        <button
          onClick={handleEnroll}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1B3A24] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2D6A3F] transition disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm">
            {loading ? 'progress_activity' : 'add_circle'}
          </span>
          {loading ? 'Redirecting…' : mod.price_myr > 0 ? `Enroll — RM ${mod.price_myr}` : 'Enroll (Free)'}
        </button>
      )}
    </>
  )

  return (
    <>
      <article
        onClick={() => setOpen(true)}
        className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm hover:shadow-md transition-all cursor-pointer"
      >
        <div className="flex items-start justify-between mb-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusBadge.bg} ${statusBadge.text}`}>
            <span className="material-symbols-outlined text-xs">{statusBadge.icon}</span>
            {statusBadge.label}
          </span>
          {mod.duration_hours > 0 && (
            <span className="text-xs text-[#94a3b8] flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">schedule</span>
              {mod.duration_hours}h
            </span>
          )}
        </div>

        <h3 className="text-lg font-bold text-[#1B3A24] mb-1">{mod.title}</h3>
        {mod.description && (
          <p className="text-sm text-[#64748b] mb-4 line-clamp-2">{mod.description}</p>
        )}

        <div className="mt-auto" onClick={e => e.stopPropagation()}>
          {actionButtons}
        </div>

        {mod.required_by_tracks.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[#e2e8f0]">
            <p className="text-[11px] text-[#94a3b8] mb-1">Required for:</p>
            <div className="flex flex-wrap gap-1.5">
              {mod.required_by_tracks.map(t => (
                <span key={t.id} className="text-[11px] bg-[#f1f5f9] text-[#64748b] px-2 py-0.5 rounded">
                  {t.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </article>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 pb-4 border-b border-[#e2e8f0]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusBadge.bg} ${statusBadge.text}`}>
                    <span className="material-symbols-outlined text-xs">{statusBadge.icon}</span>
                    {statusBadge.label}
                  </span>
                  {mod.duration_hours > 0 && (
                    <span className="text-xs text-[#94a3b8] flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">schedule</span>
                      {mod.duration_hours}h
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-black text-[#1B3A24]">{mod.title}</h2>
                {mod.description && (
                  <p className="text-sm text-[#64748b] mt-1">{mod.description}</p>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="ml-4 p-1 rounded-lg hover:bg-[#f1f5f9] transition shrink-0"
              >
                <span className="material-symbols-outlined text-[#94a3b8] text-2xl">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {mod.content ? (
                <div className="prose prose-sm max-w-none text-[#334155] whitespace-pre-wrap leading-relaxed">
                  {mod.content}
                </div>
              ) : (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-4xl text-[#cbd5e1] mb-2 block">article</span>
                  <p className="text-sm text-[#94a3b8]">No content available for this module yet.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 pt-4 border-t border-[#e2e8f0] flex items-center justify-between">
              {mod.required_by_tracks.length > 0 && (
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-[11px] text-[#94a3b8] mb-1">Required for:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mod.required_by_tracks.map(t => (
                      <span key={t.id} className="text-[11px] bg-[#f1f5f9] text-[#64748b] px-2 py-0.5 rounded">
                        {t.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="shrink-0">
                {actionButtons}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
