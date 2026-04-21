'use client'

import { useEffect, useState, useCallback } from 'react'

interface Senior        { id: string; full_name: string; group_size: number }
interface Membership    { senior_guide_id: string; guide_id: string; tpa_name: string;
                          assigned_at: string; assignment_type: 'auto' | 'manual' }
interface Unassigned    { id: string; full_name: string }
interface GuideProfile  { id: string; full_name: string }

interface Payload {
  seniors:     Senior[]
  memberships: Membership[]
  unassigned:  Unassigned[]
}

export default function HodGroupsPage() {
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [data, setData]         = useState<Payload | null>(null)
  const [guides, setGuides]     = useState<Map<string, GuideProfile>>(new Map())

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/guide-groups', { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to load groups')
      setData(body)

      // Fetch guide names for rendering memberships
      const guideIds = Array.from(new Set(
        (body.memberships as Membership[]).map((m) => m.guide_id)
      ))
      if (guideIds.length > 0) {
        const res2 = await fetch(
          `/api/admin/users?ids=${guideIds.join(',')}`,
          { cache: 'no-store' },
        ).catch(() => null)
        // The /api/admin/users endpoint already exists in the project
        // for superadmin-only user lookup. If it isn't reachable we
        // fall back to rendering the guide IDs without display names.
        if (res2 && res2.ok) {
          const body2 = await res2.json()
          const m = new Map<string, GuideProfile>()
          for (const u of body2.users ?? []) {
            m.set(u.id, { id: u.id, full_name: u.full_name ?? u.email ?? u.id })
          }
          setGuides(m)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  async function reassign(guideId: string, newSeniorId: string, tpaName: string) {
    setSaving(guideId)
    try {
      const res = await fetch(`/api/guide-groups/${guideId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senior_guide_id: newSeniorId || null, tpa_name: tpaName }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Reassign failed')
      showToast('Guide reassigned.', true)
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Reassign failed', false)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-[#2D6A3F] text-4xl">progress_activity</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-3xl mx-auto bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
          {error ?? 'No data'}
        </div>
      </div>
    )
  }

  // Index memberships by senior for quick render
  const bySenior = new Map<string, Membership[]>()
  for (const m of data.memberships) {
    if (!bySenior.has(m.senior_guide_id)) bySenior.set(m.senior_guide_id, [])
    bySenior.get(m.senior_guide_id)!.push(m)
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {toast && (
          <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white ${toast.ok ? 'bg-emerald-700' : 'bg-red-700'}`}>
            <span className="material-symbols-outlined text-base">{toast.ok ? 'check_circle' : 'error'}</span>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div>
          <p className="text-xs uppercase tracking-widest text-[#8DC63F] font-bold">HoD Tools</p>
          <h1 className="text-3xl font-black text-[#1B3A24] mt-1">Guide Groups</h1>
          <p className="text-sm text-[#64748b] mt-1">
            New guides auto-assign to the least-loaded Senior in their TPA. Override below when needed.
          </p>
        </div>

        {/* Unassigned bucket */}
        {data.unassigned.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <h3 className="font-bold text-amber-900 mb-2">
              Unassigned guides ({data.unassigned.length})
            </h3>
            <p className="text-xs text-amber-800 mb-3">
              These guides were approved but no Senior was available in their TPA. Assign manually:
            </p>
            <div className="space-y-2">
              {data.unassigned.map((g) => (
                <UnassignedRow
                  key={g.id}
                  guide={g}
                  seniors={data.seniors}
                  saving={saving === g.id}
                  onAssign={(seniorId, tpaName) => reassign(g.id, seniorId, tpaName)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Seniors + their groups */}
        <div className="grid gap-4">
          {data.seniors.map((s) => {
            const members = bySenior.get(s.id) ?? []
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#1B3A24]">{s.full_name}</p>
                    <p className="text-xs text-[#64748b]">
                      {s.group_size} guide{s.group_size === 1 ? '' : 's'} in group
                    </p>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-semibold">
                    Senior Guide
                  </span>
                </div>

                {members.length === 0 ? (
                  <div className="px-6 py-6 text-sm text-[#64748b]">
                    No guides assigned.
                  </div>
                ) : (
                  <div className="divide-y divide-[#e2e8f0]">
                    {members.map((m) => (
                      <MemberRow
                        key={m.guide_id}
                        membership={m}
                        guide={guides.get(m.guide_id)}
                        seniors={data.seniors}
                        saving={saving === m.guide_id}
                        onReassign={(newSenior) => reassign(m.guide_id, newSenior, m.tpa_name)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {data.seniors.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-[#cbd5e1] mb-2 block">supervisor_account</span>
            <p className="font-semibold text-[#1B3A24]">No Senior Guides exist yet</p>
            <p className="text-sm text-[#64748b] mt-1">
              Promote a Guide to Senior from the Admin → Users page first.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Row components ──────────────────────────────────────────────

function MemberRow({
  membership, guide, seniors, saving, onReassign,
}: {
  membership: Membership
  guide: GuideProfile | undefined
  seniors: Senior[]
  saving: boolean
  onReassign: (newSeniorId: string) => void
}) {
  const [target, setTarget] = useState<string>(membership.senior_guide_id)
  const changed = target !== membership.senior_guide_id

  return (
    <div className="px-6 py-3 flex items-center gap-4">
      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0">
        {(guide?.full_name ?? '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1B3A24] truncate">
          {guide?.full_name ?? membership.guide_id}
        </p>
        <p className="text-[11px] text-[#64748b]">
          {membership.tpa_name} · {membership.assignment_type === 'auto' ? 'auto-assigned' : 'manually assigned'}
        </p>
      </div>

      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        disabled={saving}
        className="text-sm border border-[#cbd5e1] rounded-lg px-3 py-2 bg-white"
      >
        {seniors.map((s) => (
          <option key={s.id} value={s.id}>{s.full_name}</option>
        ))}
      </select>

      <button
        onClick={() => onReassign(target)}
        disabled={!changed || saving}
        className="text-xs font-bold px-3 py-2 rounded-lg bg-primary text-white disabled:opacity-40 hover:bg-[#024a2f]"
      >
        {saving ? '…' : 'Move'}
      </button>
    </div>
  )
}

function UnassignedRow({
  guide, seniors, saving, onAssign,
}: {
  guide: Unassigned
  seniors: Senior[]
  saving: boolean
  onAssign: (seniorId: string, tpaName: string) => void
}) {
  const [senior, setSenior] = useState<string>(seniors[0]?.id ?? '')
  const [tpa, setTpa]       = useState<string>('')

  return (
    <div className="flex items-center gap-3 bg-white rounded-lg p-2">
      <p className="text-sm font-semibold text-[#1B3A24] flex-1 truncate">{guide.full_name}</p>
      <input
        type="text"
        placeholder="TPA name"
        value={tpa}
        onChange={(e) => setTpa(e.target.value)}
        className="text-xs border border-[#cbd5e1] rounded-lg px-2 py-1.5 w-36"
      />
      <select
        value={senior}
        onChange={(e) => setSenior(e.target.value)}
        className="text-xs border border-[#cbd5e1] rounded-lg px-2 py-1.5"
      >
        {seniors.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
      </select>
      <button
        disabled={!senior || !tpa || saving}
        onClick={() => onAssign(senior, tpa)}
        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-white disabled:opacity-40 hover:bg-[#024a2f]"
      >
        {saving ? '…' : 'Assign'}
      </button>
    </div>
  )
}