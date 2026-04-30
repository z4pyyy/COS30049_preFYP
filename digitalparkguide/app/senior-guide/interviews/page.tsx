'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusPopup } from '@/components/StatusPopup'

interface CertRow {
  id: string
  guide_id: string
  guide_name: string
  track_title: string
  tpa_name: string
  stage: string
  quiz_passed_at: string | null
  interview_date: string | null
  interview_time: string | null
  interview_location: string | null
  resit_count: number
}

export default function SeniorInterviewsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<CertRow[]>([])
  const [popup, setPopup] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const clearPopup = useCallback(() => setPopup(null), [])

  const [scheduling, setScheduling] = useState<string | null>(null)
  const [schedForm, setSchedForm] = useState({ date: '', time: '', location: '' })
  const [saving, setSaving] = useState(false)

  const [recording, setRecording] = useState<string | null>(null)
  const [outcomeForm, setOutcomeForm] = useState({ outcome: 'PASSED' as 'PASSED' | 'FAILED', notes: '' })

  const load = useCallback(async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: members } = await supabase
      .from('guide_group_members')
      .select('guide_id')
      .eq('senior_guide_id', user.id)

    const guideIds = (members ?? []).map(m => m.guide_id)
    if (guideIds.length === 0) { setLoading(false); return }

    const { data: certs } = await supabase
      .from('guide_track_certifications')
      .select('id, guide_id, tpa_name, stage, quiz_passed_at, interview_date, interview_time, interview_location, resit_count, training_tracks(title)')
      .in('guide_id', guideIds)
      .in('stage', ['QUIZZES_PASSED', 'PENDING_INTERVIEW'])
      .order('created_at', { ascending: false })

    const mapped: CertRow[] = (certs ?? []).map((c: Record<string, unknown>) => {
      const track = c.training_tracks as { title: string } | null
      return {
        id: c.id as string,
        guide_id: c.guide_id as string,
        guide_name: '',
        track_title: track?.title ?? '',
        tpa_name: c.tpa_name as string,
        stage: c.stage as string,
        quiz_passed_at: c.quiz_passed_at as string | null,
        interview_date: c.interview_date as string | null,
        interview_time: c.interview_time as string | null,
        interview_location: c.interview_location as string | null,
        resit_count: c.resit_count as number,
      }
    })

    const uniqueGuides = [...new Set(mapped.map(m => m.guide_id))]
    if (uniqueGuides.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', uniqueGuides)
      const nameMap = new Map((profiles ?? []).map(p => [p.id, p.full_name || p.id.slice(0, 8)]))
      mapped.forEach(m => { m.guide_name = nameMap.get(m.guide_id) || m.guide_id.slice(0, 8) })
    }

    setRows(mapped)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  const scheduleInterview = async (certId: string) => {
    if (!schedForm.date || !schedForm.time || !schedForm.location.trim()) {
      setPopup({ msg: 'Please fill in date, time, and location.', type: 'error' })
      return
    }
    setSaving(true)
    const res = await fetch(`/api/certifications/${certId}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedForm),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setPopup({ msg: d.error || 'Schedule failed', type: 'error' })
      return
    }
    setPopup({ msg: 'Interview scheduled. Guide has been notified.', type: 'success' })
    setScheduling(null)
    setSchedForm({ date: '', time: '', location: '' })
    load()
  }

  const recordOutcome = async (certId: string) => {
    setSaving(true)
    const res = await fetch(`/api/certifications/${certId}/outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(outcomeForm),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setPopup({ msg: d.error || 'Failed to record outcome', type: 'error' })
      return
    }
    setPopup({ msg: outcomeForm.outcome === 'PASSED' ? 'Interview passed. Submitted to HoD for badge approval.' : 'Interview outcome recorded.', type: 'success' })
    setRecording(null)
    setOutcomeForm({ outcome: 'PASSED', notes: '' })
    load()
  }

  const needsScheduling = rows.filter(r => r.stage === 'QUIZZES_PASSED' || (r.stage === 'PENDING_INTERVIEW' && !r.interview_date))
  const scheduled = rows.filter(r => r.stage === 'PENDING_INTERVIEW' && r.interview_date)

  return (
    <div className="max-w-5xl mx-auto p-6">
      <StatusPopup message={popup?.msg ?? null} type={popup?.type ?? 'success'} onClose={clearPopup} />

      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-black text-[#1B3A24]">Certification Interviews</h1>
        <p className="text-gray-500">Manage interview scheduling and record outcomes for your assigned guides.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="material-symbols-outlined animate-spin text-[#2D6A3F] text-4xl">progress_activity</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">event_available</span>
          <h2 className="text-xl font-bold text-gray-700 mb-2">No pending interviews</h2>
          <p className="text-gray-500">Guides in your group who complete all requirements will appear here.</p>
        </div>
      ) : (
        <>
          {needsScheduling.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-bold text-[#1B3A24] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">schedule</span>
                Awaiting Interview ({needsScheduling.length})
              </h2>
              <div className="space-y-3">
                {needsScheduling.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border border-amber-200 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-bold text-gray-900">{r.guide_name}</p>
                        <p className="text-sm text-gray-500">{r.track_title} — {r.tpa_name}</p>
                        {r.resit_count > 0 && (
                          <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                            Resit #{r.resit_count}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => { setScheduling(r.id); setSchedForm({ date: '', time: '', location: '' }) }}
                        className="bg-[#1B3A24] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#111827] transition"
                      >
                        Schedule Interview
                      </button>
                    </div>
                    {r.quiz_passed_at && (
                      <p className="text-xs text-gray-400">Quizzes passed: {new Date(r.quiz_passed_at).toLocaleDateString()}</p>
                    )}

                    {scheduling === r.id && (
                      <div className="mt-4 border-t pt-4 grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                          <input type="date" value={schedForm.date} onChange={e => setSchedForm(f => ({ ...f, date: e.target.value }))} className="w-full border rounded-lg p-2 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Time</label>
                          <input type="time" value={schedForm.time} onChange={e => setSchedForm(f => ({ ...f, time: e.target.value }))} className="w-full border rounded-lg p-2 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
                          <input value={schedForm.location} onChange={e => setSchedForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. TPA Office" className="w-full border rounded-lg p-2 text-sm" />
                        </div>
                        <div className="col-span-3 flex justify-end gap-2 mt-2">
                          <button onClick={() => setScheduling(null)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1">Cancel</button>
                          <button onClick={() => scheduleInterview(r.id)} disabled={saving} className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
                            {saving ? 'Scheduling...' : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {scheduled.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-[#1B3A24] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">event</span>
                Scheduled Interviews ({scheduled.length})
              </h2>
              <div className="space-y-3">
                {scheduled.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border border-emerald-200 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-bold text-gray-900">{r.guide_name}</p>
                        <p className="text-sm text-gray-500">{r.track_title} — {r.tpa_name}</p>
                      </div>
                      <button
                        onClick={() => { setRecording(r.id); setOutcomeForm({ outcome: 'PASSED', notes: '' }) }}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition"
                      >
                        Record Outcome
                      </button>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>{r.interview_date}</span>
                      <span>{r.interview_time}</span>
                      <span>{r.interview_location}</span>
                    </div>

                    {recording === r.id && (
                      <div className="mt-4 border-t pt-4 space-y-3">
                        <div className="flex gap-3">
                          {(['PASSED', 'FAILED'] as const).map(o => (
                            <button
                              key={o}
                              onClick={() => setOutcomeForm(f => ({ ...f, outcome: o }))}
                              className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition ${
                                outcomeForm.outcome === o
                                  ? o === 'PASSED' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-500 bg-red-50 text-red-700'
                                  : 'border-gray-200 text-gray-500'
                              }`}
                            >
                              {o}
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={outcomeForm.notes}
                          onChange={e => setOutcomeForm(f => ({ ...f, notes: e.target.value }))}
                          placeholder="Interview notes..."
                          rows={3}
                          className="w-full border rounded-lg p-2 text-sm resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setRecording(null)} className="text-sm text-gray-500 px-3 py-1">Cancel</button>
                          <button onClick={() => recordOutcome(r.id)} disabled={saving} className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
                            {saving ? 'Saving...' : 'Submit Outcome'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
