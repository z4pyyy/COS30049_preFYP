"use client"

export interface CertificationRow {
  id: string
  guide_id: string
  track_id: string
  tpa_name: string
  stage: string
  paid_at: string | null
  modules_completed_at: string | null
  quiz_attempt_id: string | null
  quiz_passed_at: string | null
  interviewer_id: string | null
  interview_scheduled_at: string | null
  interview_date: string | null
  interview_time: string | null
  interview_location: string | null
  interview_outcome: string | null
  interview_notes: string | null
  interview_completed_at: string | null
  resit_count: number
  submitted_to_hod_at: string | null
  badge_issued_at: string | null
  badge_issued_by: string | null
  certificate_no: string | null
  revoked_at: string | null
  revoked_reason: string | null
  rejection_stage: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  // view-added
  track_title: string
  duration_weeks: number | null
  guide_name: string
}

interface StageMeta {
  label: string
  pill: string
  border: string
}

const STAGE_META: Record<string, StageMeta> = {
  AWAITING_PAYMENT:       { label: 'Awaiting Payment',     pill: 'bg-gray-100 text-gray-600',       border: 'border-gray-300'    },
  PAID:                   { label: 'Payment Received',      pill: 'bg-blue-100 text-blue-700',        border: 'border-blue-300'    },
  MODULES_COMPLETED:      { label: 'Modules Completed',     pill: 'bg-blue-100 text-blue-700',        border: 'border-blue-300'    },
  QUIZZES_PASSED:         { label: 'Quizzes Passed',        pill: 'bg-blue-100 text-blue-700',        border: 'border-blue-300'    },
  PENDING_INTERVIEW:      { label: 'Interview Pending',     pill: 'bg-amber-100 text-amber-800',      border: 'border-amber-400'   },
  INTERVIEW_PASSED:       { label: 'Interview Passed',      pill: 'bg-amber-100 text-amber-800',      border: 'border-amber-400'   },
  PENDING_BADGE_APPROVAL: { label: 'Pending HoD Approval', pill: 'bg-amber-100 text-amber-800',      border: 'border-amber-400'   },
  BADGE_ISSUED:           { label: 'Badge Issued',          pill: 'bg-emerald-100 text-emerald-800',  border: 'border-[#2D6A3F]'   },
  REJECTED:               { label: 'Rejected',              pill: 'bg-red-100 text-red-700',          border: 'border-red-300'     },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function addOneYear(iso: string): string {
  const d = new Date(iso)
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString()
}

function CertificationCard({ cert }: { cert: CertificationRow }) {
  const meta = STAGE_META[cert.stage] ?? {
    label: cert.stage,
    pill:  'bg-gray-100 text-gray-600',
    border: 'border-gray-300',
  }

  const isBadgeIssued = cert.stage === 'BADGE_ISSUED'
  const isRejected    = cert.stage === 'REJECTED'

  return (
    <div className={`bg-surface-container-low p-6 rounded-xl space-y-3 border-l-4 ${meta.border}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant truncate">
            {cert.tpa_name}
          </p>
          <h3 className="text-lg font-black text-primary leading-tight">{cert.track_title}</h3>
        </div>
        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${meta.pill}`}>
          {meta.label}
        </span>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <span className="font-semibold text-on-surface-variant">Started</span>
        <span className="text-on-surface-variant">{formatDate(cert.created_at)}</span>

        {isBadgeIssued && cert.badge_issued_at && (
          <>
            <span className="font-semibold text-on-surface-variant">Issued</span>
            <span className="text-on-surface-variant">{formatDate(cert.badge_issued_at)}</span>

            <span className="font-semibold text-on-surface-variant">Renewal Due</span>
            <span className="text-on-surface-variant">{formatDate(addOneYear(cert.badge_issued_at))}</span>

            {cert.certificate_no && (
              <>
                <span className="font-semibold text-on-surface-variant">Certificate No.</span>
                <span className="text-on-surface-variant font-mono">{cert.certificate_no}</span>
              </>
            )}
          </>
        )}

        {isRejected && cert.rejection_reason && (
          <>
            <span className="font-semibold text-red-600">Reason</span>
            <span className="text-red-600">{cert.rejection_reason}</span>
          </>
        )}

        {cert.interview_date && !isBadgeIssued && !isRejected && (
          <>
            <span className="font-semibold text-on-surface-variant">Interview</span>
            <span className="text-on-surface-variant">
              {formatDate(cert.interview_date)}
              {cert.interview_location ? ` · ${cert.interview_location}` : ''}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

interface Props {
  certifications: CertificationRow[]
  fetchError: string | null
}

export function MyCertificationsClient({ certifications, fetchError }: Props) {
  if (fetchError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
        Failed to load certifications: {fetchError}
      </div>
    )
  }

  if (certifications.length === 0) {
    return (
      <div className="bg-surface-container-low p-6 rounded-xl border-l-4 border-gray-200">
        <p className="text-sm text-on-surface-variant">
          No certifications yet.{' '}
          <a href="/training/tracks" className="font-semibold text-primary hover:underline">
            Browse training tracks
          </a>{' '}
          to start your first certification.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {certifications.map((cert) => (
        <CertificationCard key={cert.id} cert={cert} />
      ))}
    </div>
  )
}
