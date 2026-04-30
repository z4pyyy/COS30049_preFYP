'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import TopNavClient from '@/components/TopNavClient'

interface Notification {
  id: string
  title: string
  body: string
  link: string | null
  read_at: string | null
  created_at: string
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Notification[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/notifications', { cache: 'no-store' })
    if (res.ok) {
      const body = await res.json()
      setRows(body.notifications ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const markRead = async (ids: string[]) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setRows(prev => prev.map(n => ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n))
  }

  const markAllRead = () => {
    const unread = rows.filter(n => !n.read_at).map(n => n.id)
    if (unread.length > 0) markRead(unread)
  }

  const unreadCount = rows.filter(n => !n.read_at).length
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <TopNavClient />
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#1B3A24]">Notifications</h1>
            <p className="text-sm text-gray-500">{unreadCount} unread</p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-[#2D6A3F] text-4xl">progress_activity</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">notifications_off</span>
            <p className="text-lg font-bold text-gray-700">No notifications yet</p>
            <p className="text-sm text-gray-500">You'll see updates here when something needs your attention.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(n => (
              <div
                key={n.id}
                className={`bg-white rounded-xl border p-4 transition-all ${
                  n.read_at ? 'border-gray-100 opacity-70' : 'border-emerald-200 bg-emerald-50/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {!n.read_at && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      )}
                      <h3 className="text-sm font-bold text-gray-900">{n.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{n.body}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                      {n.link && (
                        <Link href={n.link} className="text-xs font-semibold text-emerald-600 hover:underline">
                          View details
                        </Link>
                      )}
                    </div>
                  </div>
                  {!n.read_at && (
                    <button
                      onClick={() => markRead([n.id])}
                      className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                      title="Mark as read"
                    >
                      <span className="material-symbols-outlined text-base">done</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
