'use client'

import { useEffect, useState } from 'react'
import GeneralModuleCard from './GeneralModuleCard'

interface GMWithStatus {
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

export default function GeneralModulesTab() {
  const [modules, setModules] = useState<GMWithStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/general-modules', { cache: 'no-store' })
      const body = await res.json()
      setModules(body.modules ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="py-12 text-center">
        <span className="material-symbols-outlined animate-spin text-[#2D6A3F] text-3xl">progress_activity</span>
        <p className="text-sm text-[#64748b] mt-2">Loading general modules…</p>
      </div>
    )
  }

  if (modules.length === 0) {
    return (
      <div className="rounded-3xl bg-white p-12 shadow-lg text-center">
        <span className="material-symbols-outlined text-5xl text-[#cbd5e1] mb-4 block">menu_book</span>
        <h2 className="text-2xl font-bold text-[#1B3A24] mb-2">No general modules available</h2>
        <p className="text-[#64748b]">Check back later — your HoD has not published any general modules yet.</p>
      </div>
    )
  }

  const completedCount = modules.filter(m => m.completed).length

  return (
    <div>
      {completedCount > 0 && (
        <div className="mb-6 rounded-2xl bg-emerald-50 border border-emerald-200 px-6 py-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-emerald-700 text-2xl">verified</span>
          <div>
            <p className="font-bold text-sm text-emerald-800">
              {completedCount}/{modules.length} general module{modules.length > 1 ? 's' : ''} completed
            </p>
            {completedCount === modules.length && (
              <p className="text-emerald-600 text-xs">All modules completed — you can enroll in any track.</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map(mod => (
          <GeneralModuleCard key={mod.id} module={mod} />
        ))}
      </div>
    </div>
  )
}
