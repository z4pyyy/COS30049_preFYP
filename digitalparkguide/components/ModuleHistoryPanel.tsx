'use client'

import { useEffect, useState } from 'react'

interface VersionRecord {
  id: string
  version_number: number
  change_type: string
  source_version_id?: string | null
  track_id: string
  title: string
  order_index: number
  duration_hours: number | null
  is_active: boolean
  edited_by: string | null
  editor_name: string
  editor_role: string
  created_at: string
  training_tracks?: {
    title: string
    tpa_name: string
    track_type: string
  }[]
}

interface ModuleHistoryPanelProps {
  moduleId: string
  onRollback?: () => void
}

export function ModuleHistoryPanel({ moduleId, onRollback }: ModuleHistoryPanelProps) {
  const [versions, setVersions] = useState<VersionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeRestoreId, setActiveRestoreId] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchHistory()
  }, [moduleId])

  const fetchHistory = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/training-modules/${moduleId}/history`)
      if (!response.ok) {
        throw new Error('Unable to load version history')
      }
      const { versions } = await response.json()
      setVersions(versions || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load history'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleRollback = async (versionId: string) => {
    if (!confirm('Restore this version? This will overwrite the current module content.')) {
      return
    }

    setError(null)
    setSuccess(null)
    setActiveRestoreId(versionId)

    try {
      const response = await fetch(`/api/training-modules/${moduleId}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: versionId }),
      })

      if (!response.ok) {
        const body = await response.json()
        throw new Error(body?.error || 'Rollback failed')
      }

      setSuccess('Module restored to selected version.')
      setActiveRestoreId(null)
      fetchHistory()
      if (onRollback) {
        onRollback()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rollback failed'
      setError(message)
      setActiveRestoreId(null)
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#64748b]">Loading version history...</p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1B3A24]">Version History</h2>
          <p className="text-sm text-[#64748b]">Audit records for this module with editor identity and rollback actions.</p>
        </div>
        <button
          type="button"
          onClick={fetchHistory}
          className="rounded-full border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-medium text-[#1B3A24] hover:bg-[#f8fafc] transition"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      {versions.length === 0 ? (
        <div className="text-sm text-[#64748b]">No history records are available for this module yet.</div>
      ) : (
        <div className="space-y-3">
          {versions.map((version) => {
            const trainingTrack = version.training_tracks?.[0]
            return (
              <div key={version.id} className="rounded-2xl border border-[#e2e8f0] bg-[#fafafa] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#1B3A24]">Version {version.version_number}</p>
                    <p className="text-xs text-[#64748b]">{new Date(version.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col gap-1 text-right text-xs text-[#475569]">
                    <span>{version.change_type.replace('_', ' ')}</span>
                    <span>{version.editor_name || 'Unknown editor'}</span>
                    <span>{version.editor_role}</span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-white px-4 py-3 text-sm text-[#475569]">
                    <p className="font-medium text-[#1B3A24]">Track</p>
                    <p>{trainingTrack?.title || 'N/A'}</p>
                    <p className="text-xs text-[#64748b]">{trainingTrack?.tpa_name || 'N/A'}</p>
                  </div>
                  <div className="rounded-xl bg-white px-4 py-3 text-sm text-[#475569]">
                    <p className="font-medium text-[#1B3A24]">Status</p>
                    <p>{version.is_active ? 'Published' : 'Draft'}</p>
                    <p className="text-xs text-[#64748b]">Order {version.order_index}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-[#64748b] line-clamp-2">
                    {version.title}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRollback(version.id)}
                    disabled={activeRestoreId === version.id}
                    className="rounded-full bg-[#2D6A3F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1B3A24] transition disabled:opacity-50"
                  >
                    {activeRestoreId === version.id ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
