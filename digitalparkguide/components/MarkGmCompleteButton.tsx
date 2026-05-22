'use client'

import { useState } from 'react'

export default function MarkGmCompleteButton({ gmId }: { gmId: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handle() {
    setLoading(true)
    const res = await fetch(`/api/general-modules/${gmId}/complete`, { method: 'POST' })
    if (res.ok) {
      setDone(true)
    }
    setLoading(false)
  }

  if (done) {
    return (
      <p className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
        <span className="material-symbols-outlined text-sm">verified</span>
        Completed
      </p>
    )
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-sm">
        {loading ? 'progress_activity' : 'check_circle'}
      </span>
      {loading ? 'Completing…' : 'Mark as Complete'}
    </button>
  )
}
