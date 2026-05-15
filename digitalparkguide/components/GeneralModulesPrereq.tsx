'use client'

import { useEffect, useState } from 'react'
import type { GeneralModuleWithStatus } from '@/types/database'

interface Props {
  onStatusChange?: (satisfied: boolean) => void
}

export default function GeneralModulesPrereq({ onStatusChange }: Props) {
  const [modules, setModules] = useState<GeneralModuleWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const completedCount = modules.filter(m => m.completed).length
  const totalCount = modules.length
  const satisfied = totalCount === 0 || completedCount === totalCount

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/general-modules', { cache: 'no-store' })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Failed to load')
        if (cancelled) return
        setModules(body.modules ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!loading) onStatusChange?.(satisfied)
  }, [loading, satisfied, onStatusChange])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 text-center">
        <span className="material-symbols-outlined animate-spin text-[#2D6A3F] text-2xl">progress_activity</span>
        <p className="text-sm text-[#64748b] mt-2">Loading general modules…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (totalCount === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
        <div>
          <h3 className="font-bold text-[#1B3A24] flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">menu_book</span>
            General Training Modules
          </h3>
          <p className="text-xs text-[#64748b] mt-0.5">
            Required before enrolling in any TPA-specific track
          </p>
        </div>
        <span className="text-sm font-bold text-[#2D6A3F]">
          {completedCount}/{totalCount}
        </span>
      </div>

      {!satisfied && (
        <div className="mx-6 mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 font-medium">
          <span className="material-symbols-outlined text-base mt-0.5">lock</span>
          Complete all general modules to unlock TPA-specific training tracks.
        </div>
      )}

      <div className="divide-y divide-[#e2e8f0]">
        {modules.map(mod => (
          <div key={mod.id} className="px-6 py-4 flex items-center gap-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              mod.completed ? 'bg-emerald-100' : 'bg-[#f1f5f9]'
            }`}>
              <span className={`material-symbols-outlined text-base ${
                mod.completed ? 'text-emerald-700' : 'text-[#94a3b8]'
              }`}>
                {mod.completed ? 'check_circle' : 'radio_button_unchecked'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1B3A24]">{mod.title}</p>
              {mod.description && (
                <p className="text-xs text-[#64748b] mt-0.5 line-clamp-1">{mod.description}</p>
              )}
              {mod.completed && mod.completed_at && (
                <p className="text-[11px] text-emerald-600 mt-0.5">
                  Completed {new Date(mod.completed_at).toLocaleDateString('en-MY', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {mod.duration_hours > 0 && (
                <span className="text-[11px] text-[#94a3b8]">{mod.duration_hours}h</span>
              )}
              <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg shrink-0 ${
                mod.completed
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-[#f1f5f9] text-[#64748b]'
              }`}>
                {mod.completed ? 'Done' : 'Pending'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {satisfied && (
        <div className="px-6 py-3 bg-emerald-50 border-t border-emerald-200 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <span className="material-symbols-outlined text-base">verified</span>
          All general modules completed — TPA tracks unlocked
        </div>
      )}
    </div>
  )
}
