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
  const [confirmLeave, setConfirmLeave] = useState(false)

  async function handleActivate() {
    setLoading(true)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId }),
    })
    if (res.ok) {
      const { url } = await res.json()
      window.location.href = url
    } else {
      setLoading(false)
    }
  }

  async function handleLeave() {
    setLoading(true)
    const res = await fetch(`/api/training-tracks/${trackId}/enroll`, { method: 'DELETE' })
    if (res.ok) {
      setEnrolled(false)
      setConfirmLeave(false)
      router.refresh()
    }
    setLoading(false)
  }

  if (enrolled) {
    if (confirmLeave) {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#64748b]">No refund will be issued.</span>
          <button
            onClick={handleLeave}
            disabled={loading}
            className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 transition"
          >
            {loading ? '...' : 'Confirm deactivate'}
          </button>
          <button
            onClick={() => setConfirmLeave(false)}
            className="text-xs text-[#94a3b8] hover:text-[#64748b] transition"
          >
            Cancel
          </button>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-3 py-1.5 text-xs font-bold text-[#15803d]">
          <span className="material-symbols-outlined text-xs">verified</span>
          Active
        </span>
        <button
          onClick={() => setConfirmLeave(true)}
          className="text-xs text-[#94a3b8] hover:text-red-500 transition"
        >
          Leave
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleActivate}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl bg-[#1B3A24] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2D6A3F] transition disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-sm">
        {loading ? 'progress_activity' : 'add_circle'}
      </span>
      {loading ? 'Redirecting…' : 'Activate Track'}
    </button>
  )
}
