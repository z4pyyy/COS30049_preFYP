'use client'

import { useState } from 'react'

interface PrereqItem {
  id: string
  title: string
  price_myr: number
  completed: boolean
  enrolled: boolean
  paid: boolean
}

interface Props {
  trackId: string
  trackPrice: number
  prerequisites: PrereqItem[]
  allPrereqsMet: boolean
  isEnrolled: boolean
}

export default function BundleEnrollButton({
  trackId,
  trackPrice,
  prerequisites,
  allPrereqsMet,
  isEnrolled,
}: Props) {
  const [loading, setLoading] = useState(false)

  if (isEnrolled) return null

  if (!allPrereqsMet) {
    const notCompleted = prerequisites.filter(p => !p.completed)
    const paidPending = notCompleted.filter(p => p.paid)
    const notEnrolled = notCompleted.filter(p => !p.enrolled)

    return (
      <div>
        <button
          disabled
          className="inline-flex items-center gap-2 rounded-xl bg-[#94a3b8] px-4 py-2.5 text-sm font-semibold text-white cursor-not-allowed opacity-60"
        >
          <span className="material-symbols-outlined text-sm">lock</span>
          Activate Track
        </button>
        <p className="mt-2 text-xs text-amber-700 flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">info</span>
          Complete all prerequisite general modules first
        </p>
        <div className="mt-1 space-y-0.5 text-xs text-[#64748b]">
          {paidPending.map(g => (
            <div key={g.id} className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-amber-500">pending</span>
              {g.title} — Quiz pending
            </div>
          ))}
          {notEnrolled.map(g => (
            <div key={g.id} className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-[#94a3b8]">lock</span>
              {g.title} — Not enrolled
            </div>
          ))}
        </div>
        <a
          href="/training/tracks?tab=general-modules"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
        >
          <span className="material-symbols-outlined text-xs">arrow_forward</span>
          Go to General Modules
        </a>
      </div>
    )
  }

  async function handleCheckout() {
    setLoading(true)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'track', trackId }),
    })
    if (res.ok) {
      const { url } = await res.json()
      window.location.href = url
    } else {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-[#1B3A24] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2D6A3F] transition disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-sm">
          {loading ? 'progress_activity' : 'add_circle'}
        </span>
        {loading
          ? 'Redirecting…'
          : trackPrice > 0
            ? `Activate Track — RM ${trackPrice.toLocaleString('en-MY')}`
            : 'Activate Track (Free)'
        }
      </button>
    </div>
  )
}
