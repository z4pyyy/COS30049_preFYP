'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function NotificationBell() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function fetchCount() {
      try {
        const res = await fetch('/api/notifications', { cache: 'no-store' })
        if (!res.ok) return
        const body = await res.json()
        if (!cancelled) setCount(body.unread_count ?? 0)
      } catch {
        // silent
      }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return (
    <Link
      href="/notifications"
      className="relative flex items-center justify-center w-9 h-9 rounded-md hover:bg-gray-100 transition-colors"
      title="Notifications"
    >
      <span className="material-symbols-outlined text-xl text-gray-600" translate="no">notifications</span>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
