'use client'

import { useState, useMemo, useTransition } from 'react'
import type { CertRow, GuideOption, TrackOption } from './page'
import {
  createCertification,
  markPaid,
  markModulesCompleted,
  markQuizPassed,
  markInterviewPassed,
  issueBadge,
  rejectCertification,
} from './actions'

// ── Stage config ─────────────────────────────────────────────

const STAGES = [
  'AWAITING_PAYMENT',
  'PAID',
  'MODULES_COMPLETED',
  'PENDING_INTERVIEW',
  'PENDING_BADGE_APPROVAL',
  'BADGE_ISSUED',
] as const

const STAGE_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  AWAITING_PAYMENT:       { label: 'Awaiting Payment',    color: 'text-gray-600',    bg: 'bg-gray-100',    icon: 'payments' },
  PAID:                   { label: 'Paid',                color: 'text-blue-700',    bg: 'bg-blue-50',     icon: 'paid' },
  MODULES_COMPLETED:      { label: 'Modules Done',        color: 'text-indigo-700',  bg: 'bg-indigo-50',   icon: 'school' },
  QUIZZES_PASSED:         { label: 'Quizzes Passed',      color: 'text-purple-700',  bg: 'bg-purple-50',   icon: 'quiz' },
  PENDING_INTERVIEW:      { label: 'Pending Interview',   color: 'text-amber-700',   bg: 'bg-amber-50',    icon: 'event' },
  INTERVIEW_PASSED:       { label: 'Interview Passed',    color: 'text-teal-700',    bg: 'bg-teal-50',     icon: 'check_circle' },
  PENDING_BADGE_APPROVAL: { label: 'Pending Badge',       color: 'text-orange-700',  bg: 'bg-orange-50',   icon: 'approval' },
  BADGE_ISSUED:           { label: 'Badge Issued',        color: 'text-emerald-700', bg: 'bg-emerald-50',  icon: 'workspace_premium' },
  REJECTED:               { label: 'Rejected',            color: 'text-red-700',     bg: 'bg-red-50',      icon: 'cancel' },
}

const PIPELINE_STEPS = [
  { key: 'payment',   label: 'Payment',   icon: 'payments',          stages: ['PAID', 'MODULES_COMPLETED', 'PENDING_INTERVIEW', 'INTERVIEW_PASSED', 'PENDING_BADGE_APPROVAL', 'BADGE_ISSUED'] },
  { key: 'modules',   label: 'Modules',   icon: 'school',            stages: ['MODULES_COMPLETED', 'PENDING_INTERVIEW', 'INTERVIEW_PASSED', 'PENDING_BADGE_APPROVAL', 'BADGE_ISSUED'] },
  { key: 'quiz',      label: 'Quiz',      icon: 'quiz',              stages: ['PENDING_INTERVIEW', 'INTERVIEW_PASSED', 'PENDING_BADGE_APPROVAL', 'BADGE_ISSUED'] },
  { key: 'interview', label: 'Interview', icon: 'event',             stages: ['PENDING_BADGE_APPROVAL', 'BADGE_ISSUED'] },
  { key: 'badge',     label: 'Badge',     icon: 'workspace_premium', stages: ['BADGE_ISSUED'] },
]

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  HOD: 'HoD',
  SENIOR_GUIDE: 'Senior Guide',
  GUIDE: 'Guide',
}

function stageIndex(stage: string): number {
  const idx = STAGES.indexOf(stage as typeof STAGES[number])
  return idx >= 0 ? idx : -1
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Sub-components ───────────────────────────────────────────

function StageBadge({ stage }: { stage: string }) {
  const m = STAGE_META[stage] ?? { label: stage, color: 'text-gray-600', bg: 'bg-gray-100' }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${m.color} ${m.bg}`}>
      {m.label}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const isSenior = role === 'SENIOR_GUIDE'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
      isSenior ? 'text-amber-700 bg-amber-50' : 'text-slate-500 bg-slate-100'
    }`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

function PipelineStepper({ stage }: { stage: string }) {
  return (
    <div className="flex items-center gap-1">
      {PIPELINE_STEPS.map((step, i) => {
        const done = step.stages.includes(stage)
        const isRejected = stage === 'REJECTED'
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              isRejected ? 'bg-red-100' :
              done ? 'bg-emerald-100' : 'bg-gray-100'
            }`}>
              <span className={`material-symbols-outlined text-sm ${
                isRejected ? 'text-red-500' :
                done ? 'text-emerald-600' : 'text-gray-400'
              }`}>
                {isRejected ? 'close' : done ? 'check' : step.icon}
              </span>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <div className={`w-4 h-0.5 ${done ? 'bg-emerald-300' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-[#e2e8f0]'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`material-symbols-outlined text-base ${accent ? 'text-emerald-600' : 'text-[#94a3b8]'}`}>{icon}</span>
        <span className="text-[11px] uppercase tracking-widest text-[#64748b] font-semibold">{label}</span>
      </div>
      <p className={`text-2xl font-black ${accent ? 'text-emerald-700' : 'text-[#1B3A24]'}`}>{value}</p>
    </div>
  )
}

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-800 text-white text-sm px-5 py-3 rounded-xl shadow-lg">
      <span>{message}</span>
      <button onClick={onDismiss} className="text-white/60 hover:text-white">
        <span className="material-symbols-outlined text-base leading-none">close</span>
      </button>
    </div>
  )
}

// ── Create Certification Modal ───────────────────────────────

function CreateCertModal({
  guides,
  tracks,
  existingCerts,
  onClose,
  onCreated,
}: {
  guides: GuideOption[]
  tracks: TrackOption[]
  existingCerts: CertRow[]
  onClose: () => void
  onCreated: (msg: string) => void
}) {
  const [guideId, setGuideId] = useState('')
  const [trackId, setTrackId] = useState('')
  const [loading, startTransition] = useTransition()

  const hasExisting = guideId && trackId && existingCerts.some(
    c => c.guide_id === guideId && c.track_id === trackId && c.stage !== 'REJECTED'
  )

  function handleCreate() {
    if (!guideId || !trackId || hasExisting) return
    startTransition(async () => {
      const res = await createCertification(guideId, trackId)
      if (res.error) {
        onCreated(`Error: ${res.error}`)
      } else {
        onCreated('Certification created')
      }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-black text-[#1B3A24]">Create Certification</h2>
        <p className="text-sm text-[#64748b]">
          Start a new certification pipeline for a guide. Used for legacy guides who already hold badges from before the system.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-[#64748b] mb-1 block">Guide</label>
            <select
              value={guideId}
              onChange={e => setGuideId(e.target.value)}
              className="w-full border border-[#d1d9e0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2D6A3F] focus:ring-1 focus:ring-[#2D6A3F]"
            >
              <option value="">Select a guide...</option>
              {guides.map(g => (
                <option key={g.id} value={g.id}>
                  {g.full_name} ({ROLE_LABELS[g.role] ?? g.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-[#64748b] mb-1 block">TPA / Track</label>
            <select
              value={trackId}
              onChange={e => setTrackId(e.target.value)}
              className="w-full border border-[#d1d9e0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2D6A3F] focus:ring-1 focus:ring-[#2D6A3F]"
            >
              <option value="">Select a track...</option>
              {tracks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.tpa_name} — {t.title}
                </option>
              ))}
            </select>
          </div>

          {hasExisting && (
            <p className="text-sm text-red-600 font-semibold">
              This guide already has an active certification for this track.
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold rounded-xl border border-[#d1d9e0] text-[#64748b] hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !guideId || !trackId || !!hasExisting}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#2D6A3F] text-white hover:bg-[#1B3A24] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Reject Modal ─────────────────────────────────────────────

function RejectModal({
  guideName,
  onConfirm,
  onCancel,
  loading,
}: {
  guideName: string
  onConfirm: (reason: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-black text-[#1B3A24]">Reject Certification</h2>
        <p className="text-sm text-[#64748b]">
          Rejecting <strong>{guideName}</strong>&apos;s certification. This cannot be undone.
        </p>
        <textarea
          className="w-full border border-[#d1d9e0] rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2D6A3F]"
          rows={3}
          placeholder="Enter rejection reason (required)"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 text-sm font-semibold rounded-xl border border-[#d1d9e0] text-[#64748b] hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => onConfirm(reason.trim())} disabled={loading || !reason.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Rejecting...' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Expanded detail: pipeline condition editor ───────────────

function ConditionEditor({ row, onAction }: {
  row: CertRow
  onAction: (action: string, payload?: Record<string, string>) => void
}) {
  const [paymentRef, setPaymentRef] = useState(row.stripe_session_id ?? '')
  const [interviewNotes, setInterviewNotes] = useState('')
  const isRejected = row.stage === 'REJECTED'
  const isBadgeIssued = row.stage === 'BADGE_ISSUED'

  const steps = [
    {
      key: 'payment',
      label: 'Payment Received',
      icon: 'payments',
      done: !!row.paid_at,
      detail: row.paid_at ? `${formatDate(row.paid_at)}${row.stripe_session_id ? ` — Ref: ${row.stripe_session_id}` : ''}` : null,
      current: row.stage === 'AWAITING_PAYMENT',
      editor: (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#64748b] block mb-1">
              Payment / Invoice Reference
            </label>
            <input
              value={paymentRef}
              onChange={e => setPaymentRef(e.target.value)}
              placeholder="e.g. INV-2024-001 or Stripe session ID"
              className="w-full border border-[#d1d9e0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A3F]"
            />
          </div>
          <button
            onClick={() => onAction('markPaid', { paymentRef })}
            disabled={!paymentRef.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            Mark Paid
          </button>
        </div>
      ),
    },
    {
      key: 'modules',
      label: 'Modules Completed',
      icon: 'school',
      done: !!row.modules_completed_at,
      detail: row.modules_completed_at ? formatDate(row.modules_completed_at) : null,
      current: row.stage === 'PAID',
      editor: (
        <div className="flex gap-2 items-center">
          <p className="text-xs text-[#64748b] flex-1">
            Mark all training modules as completed. Can reference physical documentation.
          </p>
          <button
            onClick={() => onAction('markModules')}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors whitespace-nowrap"
          >
            Mark Complete
          </button>
        </div>
      ),
    },
    {
      key: 'quiz',
      label: 'Quiz Passed',
      icon: 'quiz',
      done: !!row.quiz_passed_at,
      detail: row.quiz_passed_at ? formatDate(row.quiz_passed_at) : null,
      current: row.stage === 'MODULES_COMPLETED',
      editor: (
        <div className="flex gap-2 items-center">
          <p className="text-xs text-[#64748b] flex-1">
            Mark quiz as passed. For legacy guides, can reference prior assessment records.
          </p>
          <button
            onClick={() => onAction('markQuiz')}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors whitespace-nowrap"
          >
            Mark Passed
          </button>
        </div>
      ),
    },
    {
      key: 'interview',
      label: 'Interview Passed',
      icon: 'event',
      done: !!row.interview_completed_at && row.interview_outcome === 'PASSED',
      detail: row.interview_completed_at
        ? `${formatDate(row.interview_completed_at)} — ${row.interview_outcome}${row.interviewer_name ? ` by ${row.interviewer_name}` : ''}`
        : null,
      current: row.stage === 'PENDING_INTERVIEW' || row.stage === 'INTERVIEW_PASSED',
      editor: (
        <div className="space-y-2">
          <textarea
            value={interviewNotes}
            onChange={e => setInterviewNotes(e.target.value)}
            placeholder="Interview notes (optional)"
            rows={2}
            className="w-full border border-[#d1d9e0] rounded-lg p-2 text-sm resize-none focus:outline-none focus:border-[#2D6A3F]"
          />
          <button
            onClick={() => onAction('markInterview', { notes: interviewNotes })}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            Mark Interview Passed
          </button>
        </div>
      ),
    },
    {
      key: 'badge',
      label: 'Badge Issued',
      icon: 'workspace_premium',
      done: !!row.badge_issued_at,
      detail: row.badge_issued_at
        ? `${formatDate(row.badge_issued_at)}${row.certificate_no ? ` — ${row.certificate_no}` : ''}`
        : null,
      current: row.stage === 'PENDING_BADGE_APPROVAL',
      editor: (
        <div className="flex gap-2 items-center">
          <p className="text-xs text-[#64748b] flex-1">
            Issue badge, generate certificate PDF, and notify guide via email.
          </p>
          <button
            onClick={() => onAction('issueBadge')}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors whitespace-nowrap"
          >
            Issue Badge
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="px-6 pb-5 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#64748b]">
        Certification Pipeline
      </p>
      <div className="space-y-0">
        {steps.map((step, i) => (
          <div key={step.key} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                isRejected ? 'bg-red-100' :
                step.done ? 'bg-emerald-100' :
                step.current ? 'bg-blue-100 ring-2 ring-blue-300' :
                'bg-gray-100'
              }`}>
                <span className={`material-symbols-outlined text-sm ${
                  isRejected ? 'text-red-500' :
                  step.done ? 'text-emerald-600' :
                  step.current ? 'text-blue-600' :
                  'text-gray-400'
                }`}>
                  {step.done ? 'check' : step.icon}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-[16px] ${step.done ? 'bg-emerald-200' : 'bg-gray-200'}`} />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-semibold ${
                  step.done ? 'text-emerald-700' :
                  step.current ? 'text-[#1B3A24]' :
                  'text-gray-400'
                }`}>
                  {step.label}
                </p>
                {step.detail && (
                  <span className="text-xs text-[#64748b]">{step.detail}</span>
                )}
              </div>
              {step.current && !isRejected && !isBadgeIssued && (
                <div className="mt-2">{step.editor}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Reject button (available at any non-terminal stage) */}
      {!isRejected && !isBadgeIssued && (
        <div className="pt-2 border-t border-[#e2e8f0]">
          <button
            onClick={() => onAction('reject')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">cancel</span>
            Reject Certification
          </button>
        </div>
      )}

      {row.revoked_at && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-xs font-bold text-red-700">Badge Revoked — {formatDate(row.revoked_at)}</p>
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────

type FilterStage = 'ALL' | 'IN_PROGRESS' | 'BADGE_ISSUED' | 'PENDING_BADGE_APPROVAL' | 'REJECTED'

export default function BadgeTrackClient({
  initialRows,
  guides,
  tracks,
  fetchError,
}: {
  initialRows: CertRow[]
  guides: GuideOption[]
  tracks: TrackOption[]
  fetchError: string | null
}) {
  const [rows, setRows] = useState(initialRows)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<FilterStage>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectingRow, setRejectingRow] = useState<CertRow | null>(null)
  const [rejectLoading, startReject] = useTransition()
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const tpaNames = useMemo(() => [...new Set(rows.map(r => r.tpa_name))].sort(), [rows])

  const filtered = useMemo(() => {
    let result = rows
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        r.guide_name.toLowerCase().includes(q) ||
        r.tpa_name.toLowerCase().includes(q) ||
        r.certificate_no?.toLowerCase().includes(q)
      )
    }
    if (stageFilter === 'BADGE_ISSUED') {
      result = result.filter(r => r.stage === 'BADGE_ISSUED' && !r.revoked_at)
    } else if (stageFilter === 'IN_PROGRESS') {
      result = result.filter(r => r.stage !== 'BADGE_ISSUED' && r.stage !== 'REJECTED')
    } else if (stageFilter === 'PENDING_BADGE_APPROVAL') {
      result = result.filter(r => r.stage === 'PENDING_BADGE_APPROVAL')
    } else if (stageFilter === 'REJECTED') {
      result = result.filter(r => r.stage === 'REJECTED')
    }
    return result
  }, [rows, search, stageFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, CertRow[]>()
    for (const tpa of tpaNames) map.set(tpa, [])
    for (const r of filtered) {
      if (!map.has(r.tpa_name)) map.set(r.tpa_name, [])
      map.get(r.tpa_name)!.push(r)
    }
    return map
  }, [filtered, tpaNames])

  const badgeCount = rows.filter(r => r.stage === 'BADGE_ISSUED' && !r.revoked_at).length
  const inProgressCount = rows.filter(r => r.stage !== 'BADGE_ISSUED' && r.stage !== 'REJECTED').length
  const pendingApproval = rows.filter(r => r.stage === 'PENDING_BADGE_APPROVAL').length

  async function handleAction(row: CertRow, action: string, payload?: Record<string, string>) {
    if (action === 'reject') {
      setRejectingRow(row)
      return
    }

    setActionLoading(row.id)
    let result: { success?: true; error?: string; certificateNo?: string | null } = {}

    switch (action) {
      case 'markPaid':
        result = await markPaid(row.id, payload?.paymentRef ?? '')
        break
      case 'markModules':
        result = await markModulesCompleted(row.id)
        break
      case 'markQuiz':
        result = await markQuizPassed(row.id)
        break
      case 'markInterview':
        result = await markInterviewPassed(row.id, payload?.notes)
        break
      case 'issueBadge':
        result = await issueBadge(row.id)
        break
    }

    setActionLoading(null)

    if (result.error) {
      showToast(`Error: ${result.error}`)
    } else {
      const msg = action === 'issueBadge' && 'certificateNo' in result
        ? `Badge issued — ${result.certificateNo}`
        : 'Updated successfully'
      showToast(msg)
      // Reload page to get fresh data
      window.location.reload()
    }
  }

  function handleRejectConfirm(reason: string) {
    if (!rejectingRow) return
    const certId = rejectingRow.id
    startReject(async () => {
      const res = await rejectCertification(certId, reason)
      if (res.error) {
        showToast(`Error: ${res.error}`)
      } else {
        showToast('Certification rejected')
        window.location.reload()
      }
      setRejectingRow(null)
    })
  }

  if (fetchError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
        {fetchError}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Certifications" value={rows.length} icon="description" />
          <StatCard label="Badges Issued" value={badgeCount} icon="workspace_premium" accent />
          <StatCard label="In Progress" value={inProgressCount} icon="pending" />
          <StatCard label="Pending Approval" value={pendingApproval} icon="approval" />
        </div>

        {/* Actions + Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2D6A3F] text-white text-sm font-semibold hover:bg-[#1B3A24] transition-colors"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Create Certification
          </button>

          <div className="relative flex-1 min-w-[200px] max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-[#94a3b8]">search</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, TPA, or certificate..."
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-[#d1d9e0] rounded-xl focus:outline-none focus:border-[#2D6A3F] focus:ring-1 focus:ring-[#2D6A3F] bg-white"
            />
          </div>

          <div className="flex gap-1.5">
            {([
              ['ALL', 'All'],
              ['IN_PROGRESS', 'In Progress'],
              ['PENDING_BADGE_APPROVAL', 'Pending Approval'],
              ['BADGE_ISSUED', 'Badge Holders'],
              ['REJECTED', 'Rejected'],
            ] as [FilterStage, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStageFilter(key)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  stageFilter === key
                    ? 'bg-[#2D6A3F] text-white'
                    : 'bg-white border border-[#d1d9e0] text-[#64748b] hover:border-[#2D6A3F] hover:text-[#1B3A24]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Grouped by TPA */}
        {[...grouped.entries()].map(([tpa, certRows]) => {
          if (certRows.length === 0 && stageFilter !== 'ALL') return null
          const tpaBadges = certRows.filter(r => r.stage === 'BADGE_ISSUED' && !r.revoked_at).length
          return (
            <div key={tpa} className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-xl text-[#2D6A3F]">park</span>
                  <div>
                    <h2 className="font-bold text-[#1B3A24]">{tpa}</h2>
                    <p className="text-xs text-[#64748b]">
                      {certRows.length} certification{certRows.length === 1 ? '' : 's'} · {tpaBadges} badge{tpaBadges === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              </div>

              {certRows.length === 0 ? (
                <div className="px-6 py-6 text-sm text-[#94a3b8]">No certifications match filter.</div>
              ) : (
                <div className="divide-y divide-[#e2e8f0]">
                  {certRows.map(r => {
                    const isExpanded = expandedId === r.id
                    const isLoading = actionLoading === r.id
                    return (
                      <div key={r.id}>
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : r.id)}
                          className="w-full px-6 py-4 flex items-center gap-4 text-left hover:bg-[#f8fafc] transition-colors"
                          disabled={isLoading}
                        >
                          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {r.guide_name.charAt(0).toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-[#1B3A24] text-sm">{r.guide_name}</span>
                              <RoleBadge role={r.guide_role} />
                              <StageBadge stage={r.stage} />
                            </div>
                            <p className="text-xs text-[#64748b] mt-0.5">
                              Enrolled {formatDate(r.created_at)}
                              {r.certificate_no && ` · ${r.certificate_no}`}
                            </p>
                          </div>

                          <PipelineStepper stage={r.stage} />

                          <span className="material-symbols-outlined text-[#94a3b8] ml-2" translate="no">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>

                        {isExpanded && (
                          isLoading ? (
                            <div className="px-6 pb-5 flex items-center gap-2 text-sm text-[#64748b]">
                              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                              Processing...
                            </div>
                          ) : (
                            <ConditionEditor
                              row={r}
                              onAction={(action, payload) => handleAction(r, action, payload)}
                            />
                          )
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-[#cbd5e1] mb-2 block">search_off</span>
            <p className="font-semibold text-[#1B3A24]">No certifications found</p>
            <p className="text-sm text-[#64748b] mt-1">
              {search ? 'Try adjusting your search.' : 'Create a certification to get started.'}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateCertModal
          guides={guides}
          tracks={tracks}
          existingCerts={rows}
          onClose={() => setShowCreate(false)}
          onCreated={(msg) => {
            showToast(msg)
            window.location.reload()
          }}
        />
      )}

      {rejectingRow && (
        <RejectModal
          guideName={rejectingRow.guide_name}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectingRow(null)}
          loading={rejectLoading}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  )
}
