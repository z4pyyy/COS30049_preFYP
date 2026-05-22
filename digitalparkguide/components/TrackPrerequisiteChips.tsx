'use client'

interface PrereqItem {
  id: string
  title: string
  completed: boolean
  completed_at: string | null
  enrolled: boolean
  paid: boolean
}

interface Props {
  prerequisites: PrereqItem[]
}

export default function TrackPrerequisiteChips({ prerequisites }: Props) {
  if (prerequisites.length === 0) return null

  return (
    <div className="mt-3 mb-4">
      <p className="text-[11px] uppercase tracking-widest text-[#94a3b8] font-bold mb-2">
        Prerequisites
      </p>
      <div className="flex flex-wrap gap-2">
        {prerequisites.map(p => {
          let icon: string
          let bg: string
          let text: string
          let label: string

          if (p.completed) {
            icon = 'check_circle'
            bg = 'bg-emerald-50 border-emerald-200'
            text = 'text-emerald-700'
            label = `${p.title} — Completed`
          } else if (p.enrolled && p.paid) {
            icon = 'school'
            bg = 'bg-blue-50 border-blue-200'
            text = 'text-blue-700'
            label = `${p.title} — Enrolled`
          } else {
            icon = 'lock'
            bg = 'bg-[#f1f5f9] border-[#e2e8f0]'
            text = 'text-[#94a3b8]'
            label = p.title
          }

          return (
            <span
              key={p.id}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${bg} ${text}`}
            >
              <span className="material-symbols-outlined text-xs">{icon}</span>
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
