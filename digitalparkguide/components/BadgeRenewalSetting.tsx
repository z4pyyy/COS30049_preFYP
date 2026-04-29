'use client'

// Bug 11: superadmin-only control for the platform-wide badge renewal period.
// Reads/writes public.app_settings key='badge_renewal_months' (migration 012).
// RLS on app_settings restricts writes to SUPERADMIN role.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BadgeRenewalSetting() {
  const supabase = createClient()
  const [months, setMonths] = useState<number | ''>(24)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'badge_renewal_months')
        .maybeSingle()
      if (cancelled) return
      if (data?.value != null) {
        const v = typeof data.value === 'number' ? data.value : parseInt(String(data.value), 10)
        if (!Number.isNaN(v)) setMonths(v)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const save = async () => {
    if (months === '' || months < 1 || months > 120) {
      showToast('Renewal period must be between 1 and 120 months.', false)
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key: 'badge_renewal_months', value: months, description: 'Number of months until an issued badge requires renewal.' },
        { onConflict: 'key' },
      )
    setSaving(false)
    if (error) {
      showToast(error.message, false)
      return
    }
    showToast('Renewal period updated.', true)
  }

  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm space-y-4">
      {toast && (
        <div className={`text-xs font-semibold px-3 py-2 rounded-lg ${toast.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
          {toast.msg}
        </div>
      )}
      <div>
        <h3 className="text-base font-bold text-primary">Badge Renewal Period</h3>
        <p className="text-xs text-on-surface-variant mt-1">
          Months until an issued guide badge requires renewal. Applies to all new and renewed badges.
        </p>
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Months</label>
          <input
            type="number"
            min={1}
            max={120}
            disabled={loading}
            value={months}
            onChange={e => setMonths(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 0))}
            className="w-full border border-outline-variant/40 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={save}
          disabled={saving || loading}
          className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <p className="text-[10px] text-on-surface-variant/70">Only the SFC Management account (SUPERADMIN) can change this. Writes to other roles will be rejected by RLS.</p>
    </div>
  )
}
