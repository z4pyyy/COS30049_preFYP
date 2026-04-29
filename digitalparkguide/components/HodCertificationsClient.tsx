"use client"

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { issueBadge, rejectCertification } from '@/app/dashboard/hod/certifications/actions'

export interface PendingApprovalRow {
  id: string
  guide_id: string
  guide_name: string
  tpa_name: string
  track_title: string
  submitted_to_hod_at: string | null
  created_at: string
}

interface ApprovalPacket {
  certification: Record<string, unknown>
  guide: { full_name: string; phone: string | null; role: string }
  track: { title: string; tpa_name: string; duration_weeks: number | null }
  interviewer: { full_name: string | null }
  modules_completed: { title: string; completed_at: string }[]
  quiz_result: { score: number; passed: boolean; attempt_at: string } | null
  documents: { id: string; file_name: string; storage_path: string }[]
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
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

function RejectModal({
  guideName,
  trackTitle,
  onConfirm,
  onCancel,
  loading,
}: {
  guideName: string
  trackTitle: string
  onConfirm: (reason: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-black text-on-surface">Reject Certification</h2>
        <p className="text-sm text-on-surface-variant">
          Rejecting <strong>{guideName}</strong>&apos;s application for <strong>{trackTitle}</strong>.
          This cannot be undone.
        </p>
        <textarea
          className="w-full border border-outline-variant rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          rows={3}
          placeholder="Enter rejection reason (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold rounded-xl border border-outline-variant text-on-surface hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={loading || !reason.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Rejecting…' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ApprovalDetail({ packet }: { packet: ApprovalPacket }) {
  return (
    <div className="mt-4 space-y-5 border-t border-outline-variant/20 pt-4">
      {/* Guide profile */}
      <div>
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
          Guide Profile
        </p>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold text-on-surface-variant">Name</span>
          <span>{packet.guide.full_name}</span>
          {packet.guide.phone && (
            <>
              <span className="font-semibold text-on-surface-variant">Phone</span>
              <span>{packet.guide.phone}</span>
            </>
          )}
          <span className="font-semibold text-on-surface-variant">Role</span>
          <span>{packet.guide.role}</span>
        </div>
      </div>

      {/* Module completions */}
      {packet.modules_completed.length > 0 && (
        <div>
          <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
            Modules Completed ({packet.modules_completed.length})
          </p>
          <ul className="space-y-1">
            {packet.modules_completed.map((m, i) => (
              <li key={i} className="flex justify-between text-sm">
                <span>{m.title}</span>
                <span className="text-on-surface-variant">{formatDate(m.completed_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quiz result */}
      {packet.quiz_result && (
        <div>
          <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
            Quiz Result
          </p>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-on-surface-variant">Score</span>
            <span>{packet.quiz_result.score}</span>
            <span className="font-semibold text-on-surface-variant">Status</span>
            <span className={packet.quiz_result.passed ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold'}>
              {packet.quiz_result.passed ? 'Passed' : 'Failed'}
            </span>
            <span className="font-semibold text-on-surface-variant">Attempt Date</span>
            <span>{formatDate(packet.quiz_result.attempt_at)}</span>
          </div>
        </div>
      )}

      {/* Interview */}
      {packet.interviewer.full_name && (
        <div>
          <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
            Interview
          </p>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-on-surface-variant">Interviewer</span>
            <span>{packet.interviewer.full_name}</span>
          </div>
        </div>
      )}

      {/* Documents */}
      {packet.documents.length > 0 && (
        <div>
          <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
            Documents ({packet.documents.length})
          </p>
          <ul className="space-y-1">
            {packet.documents.map((d) => (
              <li key={d.id} className="text-sm text-primary underline cursor-pointer">
                {d.file_name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

interface RowProps {
  row: PendingApprovalRow
  expanded: boolean
  packet: ApprovalPacket | null
  packetLoading: boolean
  issued: boolean
  onToggle: () => void
  onIssue: () => void
  onRejectClick: () => void
  issuing: boolean
}

function ApprovalRow({
  row,
  expanded,
  packet,
  packetLoading,
  issued,
  onToggle,
  onIssue,
  onRejectClick,
  issuing,
}: RowProps) {
  return (
    <div className="bg-surface-container-low rounded-xl border border-outline-variant/20 overflow-hidden">
      {/* Row header — clickable to expand */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant truncate">
            {row.tpa_name}
          </p>
          <p className="text-base font-black text-primary truncate">{row.track_title}</p>
          <p className="text-sm text-on-surface-variant">{row.guide_name}</p>
        </div>
        <div className="shrink-0 text-right space-y-1">
          <p className="text-xs text-on-surface-variant">Submitted</p>
          <p className="text-xs font-semibold text-on-surface">{formatDate(row.submitted_to_hod_at)}</p>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant ml-2">
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {packetLoading && (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant animate-pulse">
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
              Loading approval packet…
            </div>
          )}
          {packet && <ApprovalDetail packet={packet} />}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            {issued ? (
              <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-100 text-emerald-800 text-sm font-semibold">
                <span className="material-symbols-outlined text-base leading-none">check_circle</span>
                Badge Issued
              </span>
            ) : (
              <>
                <button
                  onClick={onIssue}
                  disabled={issuing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2D6A3F] text-white text-sm font-semibold hover:bg-[#1B3A24] disabled:opacity-50 transition-colors"
                >
                  {issuing ? (
                    <>
                      <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                      Issuing…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base leading-none">workspace_premium</span>
                      Issue Badge
                    </>
                  )}
                </button>
                <button
                  onClick={onRejectClick}
                  disabled={issuing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-300 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-base leading-none">cancel</span>
                  Reject
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  initialRows: PendingApprovalRow[]
  fetchError: string | null
}

export function HodCertificationsClient({ initialRows, fetchError }: Props) {
  const supabase = createClient()

  const [rows, setRows]               = useState(initialRows)
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [packets, setPackets]         = useState<Record<string, ApprovalPacket>>({})
  const [packetLoading, setPacketLoading] = useState<string | null>(null)
  const [issuedIds, setIssuedIds]     = useState<Set<string>>(new Set())
  const [issuingId, setIssuingId]     = useState<string | null>(null)
  const [rejectingRow, setRejectingRow] = useState<PendingApprovalRow | null>(null)
  const [rejectLoading, startReject]  = useTransition()
  const [toast, setToast]             = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function handleToggle(row: PendingApprovalRow) {
    if (expandedId === row.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(row.id)
    if (packets[row.id]) return

    setPacketLoading(row.id)
    const { data, error } = await supabase.rpc('get_hod_approval_packet', { p_cert_id: row.id })
    setPacketLoading(null)
    if (error) {
      showToast(`Failed to load packet: ${error.message}`)
    } else if (data) {
      setPackets((prev) => ({ ...prev, [row.id]: data as ApprovalPacket }))
    }
  }

  async function handleIssue(certId: string) {
    setIssuingId(certId)
    const result = await issueBadge(certId)
    setIssuingId(null)
    if (result.error) {
      showToast(`Error: ${result.error}`)
    } else {
      setIssuedIds((prev) => new Set(prev).add(certId))
      setRows((prev) => prev.filter((r) => r.id !== certId))
      setExpandedId(null)
      showToast(
        result.certificateNo
          ? `Badge issued — ${result.certificateNo}`
          : 'Badge issued successfully',
      )
    }
  }

  function handleRejectConfirm(reason: string) {
    if (!rejectingRow) return
    const certId = rejectingRow.id
    startReject(async () => {
      const result = await rejectCertification(certId, reason)
      if (result.error) {
        showToast(`Error: ${result.error}`)
      } else {
        setRows((prev) => prev.filter((r) => r.id !== certId))
        setExpandedId(null)
        showToast('Certification rejected.')
      }
      setRejectingRow(null)
    })
  }

  if (fetchError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
        Failed to load approvals: {fetchError}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="bg-surface-container-low p-6 rounded-xl border-l-4 border-gray-200">
        <p className="text-sm text-on-surface-variant">No certifications are currently pending badge approval.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {rows.map((row) => (
          <ApprovalRow
            key={row.id}
            row={row}
            expanded={expandedId === row.id}
            packet={packets[row.id] ?? null}
            packetLoading={packetLoading === row.id}
            issued={issuedIds.has(row.id)}
            onToggle={() => handleToggle(row)}
            onIssue={() => handleIssue(row.id)}
            onRejectClick={() => setRejectingRow(row)}
            issuing={issuingId === row.id}
          />
        ))}
      </div>

      {rejectingRow && (
        <RejectModal
          guideName={rejectingRow.guide_name}
          trackTitle={rejectingRow.track_title}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectingRow(null)}
          loading={rejectLoading}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  )
}
