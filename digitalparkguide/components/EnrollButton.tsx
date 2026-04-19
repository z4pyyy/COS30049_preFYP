'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface EnrollButtonProps {
  trackId: string
  enrolled: boolean
}

export function EnrollButton({ trackId, enrolled: initialEnrolled }: EnrollButtonProps) {
  const router = useRouter()
  const [enrolled, setEnrolled] = useState(initialEnrolled)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const method = enrolled ? 'DELETE' : 'POST'
    const res = await fetch(`/api/training-tracks/${trackId}/enroll`, { method })
    if (res.ok) {
      setEnrolled(!enrolled)
      router.refresh()
    }
    setLoading(false)
  }

  if (enrolled) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-3 py-1.5 text-xs font-bold text-[#15803d]">
          <span className="material-symbols-outlined text-xs">verified</span>
          Active
        </span>
        <button
          onClick={toggle}
          disabled={loading}
          className="text-xs text-[#94a3b8] hover:text-red-500 transition disabled:opacity-50"
        >
          {loading ? '...' : 'Leave'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl bg-[#1B3A24] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2D6A3F] transition disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-sm">add_circle</span>
      {loading ? 'Activating…' : 'Activate Track'}
    </button>
  )
}
