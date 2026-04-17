// HoD Announcements Management Page

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Announcement {
  id: string
  title: string
  category: string
  published: boolean
  created_at: string
}

export default function AnnouncementsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('GENERAL')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?next=/dashboard/hod/announcements')
        return
      }

      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAnnouncements(data || [])
    } catch (err) {
      console.error('Failed to fetch announcements:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    try {
      setIsCreating(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('announcements')
        .insert({
          title: newTitle,
          category: newCategory,
          published: false,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error

      setAnnouncements((prev) => [
        {
          id: data.id,
          title: data.title,
          category: data.category,
          published: data.published,
          created_at: data.created_at,
        },
        ...prev,
      ])

      setNewTitle('')
      setNewCategory('GENERAL')
    } catch (err) {
      console.error('Failed to create announcement:', err)
      alert('Failed to create announcement')
    } finally {
      setIsCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="animate-spin text-3xl">⏳</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6">
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold text-[#1B3A24] mb-2">Platform Announcements</h1>
        <p className="text-[#64748b] mb-8">Create and manage platform-wide announcements</p>

        {/* Create Form */}
        <form onSubmit={handleCreateAnnouncement} className="bg-white rounded-lg p-6 shadow-sm mb-8 border border-[#e2e8f0]">
          <h2 className="text-lg font-semibold text-[#1B3A24] mb-4">New Announcement</h2>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Announcement title..."
              className="flex-1 px-4 py-2 border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D6A3F]"
              disabled={isCreating}
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="px-4 py-2 border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D6A3F]"
              disabled={isCreating}
            >
              <option value="GENERAL">General</option>
              <option value="TRAINING">Training</option>
              <option value="ALERT">Alert</option>
            </select>
            <button
              type="submit"
              disabled={isCreating || !newTitle.trim()}
              className="px-6 py-2 bg-[#2D6A3F] text-white font-medium rounded-lg hover:bg-[#1B3A24] disabled:opacity-50"
            >
              {isCreating ? '⏳' : '➕'} Create
            </button>
          </div>
        </form>

        {/* Announcements List */}
        {announcements.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-sm">
            <div className="text-4xl mb-3">📢</div>
            <p className="text-[#64748b]">No announcements yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className="bg-white rounded-lg p-4 shadow-sm border border-[#e2e8f0] hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#1B3A24]">{ann.title}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                        {ann.category}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          ann.published
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {ann.published ? '✓ Published' : '⊝ Draft'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[#64748b]">
                    {new Date(ann.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}