'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'

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

// ── Multi-select TPA dropdown with search ─────────────────────
function TpaFilterDropdown({
  tpaList,
  tpaCounts,
  selected,
  onToggle,
  onClear,
  totalCount,
}: {
  tpaList: string[]
  tpaCounts: Map<string, number>
  selected: Set<string>
  onToggle: (tpa: string) => void
  onClear: () => void
  totalCount: number
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = tpaList.filter(t =>
    t.toLowerCase().includes(search.toLowerCase())
  )

  const label = selected.size === 0
    ? `All TPAs (${totalCount})`
    : selected.size === 1
      ? `${[...selected][0]} (${tpaCounts.get([...selected][0]) || 0})`
      : `${selected.size} TPAs selected`

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#d1d9e0] bg-white text-sm font-semibold text-[#1B3A24] hover:border-[#2D6A3F] transition-all min-w-[220px]"
      >
        <span className="material-symbols-outlined text-base text-[#2D6A3F]" translate="no">filter_list</span>
        <span className="flex-1 text-left truncate">{label}</span>
        <span className="material-symbols-outlined text-base text-[#94a3b8]" translate="no">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl border border-[#d1d9e0] shadow-xl z-40 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-[#f0f0f0]">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-[#94a3b8]">search</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search TPAs..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-[#e2e8f0] rounded-lg focus:outline-none focus:border-[#2D6A3F] focus:ring-1 focus:ring-[#2D6A3F]"
                autoFocus
              />
            </div>
          </div>

          {/* Clear / Select all */}
          <div className="px-3 py-2 border-b border-[#f0f0f0] flex items-center justify-between">
            <button
              onClick={onClear}
              className={`text-xs font-semibold transition-colors ${selected.size === 0 ? 'text-[#2D6A3F] font-bold' : 'text-[#64748b] hover:text-[#1B3A24]'}`}
            >
              All TPAs ({totalCount})
            </button>
            {selected.size > 0 && (
              <button onClick={onClear} className="text-xs text-red-500 hover:text-red-700 font-semibold">
                Clear filter
              </button>
            )}
          </div>

          {/* TPA list */}
          <div className="max-h-64 overflow-y-auto overscroll-contain">
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-[#94a3b8] text-center">No TPAs match &ldquo;{search}&rdquo;</p>
            ) : (
              filtered.map(tpa => {
                const isSelected = selected.has(tpa)
                const count = tpaCounts.get(tpa) || 0
                return (
                  <button
                    key={tpa}
                    onClick={() => onToggle(tpa)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                      isSelected ? 'bg-emerald-50 text-[#1B3A24]' : 'hover:bg-[#f8fafc] text-[#334155]'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                      isSelected ? 'border-[#2D6A3F] bg-[#2D6A3F]' : 'border-[#cbd5e1]'
                    }`}>
                      {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                    </span>
                    <span className="flex-1 truncate font-medium">{tpa}</span>
                    <span className="text-xs text-[#94a3b8] tabular-nums">{count}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import ThemedSelect from '@/components/ThemedSelect'

export default function HodGroupsPage() {
  const supabase = createClient()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [data, setData]         = useState<Payload | null>(null)
  const [guides, setGuides]     = useState<Map<string, GuideProfile>>(new Map())
  const [tpaList, setTpaList]   = useState<string[]>([])
  const [selectedTpas, setSelectedTpas] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/guide-groups', { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to load groups')
      setData(body)

      const guideIds = Array.from(new Set(
        (body.memberships as Membership[]).map((m) => m.guide_id)
      ))
      if (guideIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', guideIds)
        const m = new Map<string, GuideProfile>()
        for (const p of profiles ?? []) {
          m.set(p.id, { id: p.id, full_name: p.full_name || p.id.slice(0, 8) })
        }
        setGuides(m)
      }

      const { data: tracks } = await supabase
        .from('training_tracks')
        .select('tpa_name')
      const uniqueTpas = [...new Set((tracks ?? []).map(t => t.tpa_name).filter(Boolean))]
      uniqueTpas.sort()
      setTpaList(uniqueTpas)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function nominateSenior(guideId: string, guideName: string) {
    if (!confirm(`Promote ${guideName} to Senior Guide?`)) return
    setSaving(guideId)
    const { error: err } = await supabase.rpc('nominate_senior_guide', { p_guide_id: guideId })
    setSaving(null)
    if (err) { showToast(err.message, false); return }
    showToast(`${guideName} promoted to Senior Guide.`, true)
    load()
  }

  function toggleTpa(tpa: string) {
    setSelectedTpas(prev => {
      const next = new Set(prev)
      if (next.has(tpa)) next.delete(tpa)
      else next.add(tpa)
      return next
    })
  }

  const filteredMemberships = useMemo(() => {
    if (!data) return []
    if (selectedTpas.size === 0) return data.memberships
    return data.memberships.filter(m => selectedTpas.has(m.tpa_name))
  }, [data, selectedTpas])

  const tpaCounts = useMemo(() => {
    if (!data) return new Map<string, number>()
    const counts = new Map<string, number>()
    for (const m of data.memberships) {
      counts.set(m.tpa_name, (counts.get(m.tpa_name) || 0) + 1)
    }
    return counts
  }, [data])

  const bySenior = useMemo(() => {
    const map = new Map<string, Membership[]>()
    for (const m of filteredMemberships) {
      if (!map.has(m.senior_guide_id)) map.set(m.senior_guide_id, [])
      map.get(m.senior_guide_id)!.push(m)
    }
    return map
  }, [filteredMemberships])

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

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {toast && (
          <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white ${toast.ok ? 'bg-emerald-700' : 'bg-red-700'}`}>
            <span className="material-symbols-outlined text-base">{toast.ok ? 'check_circle' : 'error'}</span>
            {toast.msg}
          </div>
        )}

        {/* Header + Filter */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#8DC63F] font-bold">HoD Tools</p>
            <h1 className="text-3xl font-black text-[#1B3A24] mt-1">Guide Groups</h1>
            <p className="text-sm text-[#64748b] mt-1">
              New guides auto-assign to the least-loaded Senior in their TPA. Override below when needed.
            </p>
          </div>
          <TpaFilterDropdown
            tpaList={tpaList}
            tpaCounts={tpaCounts}
            selected={selectedTpas}
            onToggle={toggleTpa}
            onClear={() => setSelectedTpas(new Set())}
            totalCount={data.memberships.length}
          />
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
                  tpaList={tpaList}
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
            const totalMembers = data.memberships.filter(m => m.senior_guide_id === s.id).length
            if (selectedTpas.size > 0 && members.length === 0) return null

            return (
              <div key={s.id} className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#1B3A24]">{s.full_name}</p>
                    <p className="text-xs text-[#64748b]">
                      {selectedTpas.size > 0
                        ? `${members.length} guide${members.length === 1 ? '' : 's'} in filtered TPAs (${totalMembers} total)`
                        : `${totalMembers} guide${totalMembers === 1 ? '' : 's'} in group`
                      }
                    </p>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-semibold">
                    Senior Guide
                  </span>
                </div>

                {members.length === 0 ? (
                  <div className="px-6 py-6 text-sm text-[#64748b]">
                    No guides assigned{selectedTpas.size > 0 ? ' for selected TPAs' : ''}.
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
                        onNominate={() => nominateSenior(m.guide_id, guides.get(m.guide_id)?.full_name ?? m.guide_id)}
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
  membership, guide, seniors, saving, onReassign, onNominate,
}: {
  membership: Membership
  guide: GuideProfile | undefined
  seniors: Senior[]
  saving: boolean
  onReassign: (newSeniorId: string) => void
  onNominate: () => void
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

      <ThemedSelect
        value={target}
        onChange={setTarget}
        options={seniors.map(s => ({ value: s.id, label: s.full_name }))}
        disabled={saving}
        className="w-40"
      />

      <button
        onClick={() => onReassign(target)}
        disabled={!changed || saving}
        className="text-xs font-bold px-3 py-2 rounded-lg bg-primary text-white disabled:opacity-40 hover:bg-[#024a2f] transition-colors"
      >
        {saving ? '…' : 'Move'}
      </button>

      <button
        onClick={onNominate}
        disabled={saving}
        className="text-xs font-semibold text-emerald-600 hover:underline disabled:opacity-40"
      >
        Nominate Senior
      </button>
    </div>
  )
}

function UnassignedRow({
  guide, seniors, tpaList, saving, onAssign,
}: {
  guide: Unassigned
  seniors: Senior[]
  tpaList: string[]
  saving: boolean
  onAssign: (seniorId: string, tpaName: string) => void
}) {
  const [senior, setSenior] = useState<string>(seniors[0]?.id ?? '')
  const [tpa, setTpa]       = useState<string>('')

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl p-3">
      <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0">
        {guide.full_name.charAt(0).toUpperCase()}
      </div>
      <p className="text-sm font-semibold text-[#1B3A24] flex-1 truncate">{guide.full_name}</p>

      <ThemedSelect
        value={tpa}
        onChange={setTpa}
        options={[
          { value: '', label: 'Select TPA' },
          ...tpaList.map(t => ({ value: t, label: t })),
        ]}
        className="w-44"
      />

      <ThemedSelect
        value={senior}
        onChange={setSenior}
        options={seniors.map(s => ({ value: s.id, label: s.full_name }))}
        className="w-40"
      />

      <button
        disabled={!senior || !tpa || saving}
        onClick={() => onAssign(senior, tpa)}
        className="text-xs font-bold px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-40 hover:bg-[#024a2f] transition-colors"
      >
        {saving ? '…' : 'Assign'}
      </button>
    </div>
  )
}
