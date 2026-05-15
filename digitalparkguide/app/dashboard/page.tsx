"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasMinRole, can, type AppRole } from "@/types/roles";
import { ModuleEditorForm, ModuleEditorState } from "@/components/ModuleEditorForm";
import { GeneralModuleEditorForm, GeneralModuleEditorState } from "@/components/GeneralModuleEditorForm";
import { ModuleHistoryPanel } from "@/components/ModuleHistoryPanel";
import TrainingProgressWidget from "@/components/TrainingProgressWidget";
import GeneralModulesPrereq from "@/components/GeneralModulesPrereq";
import MyBadgesWidget from "@/components/MyBadgesWidget";
import { GuideBadgesSection } from "@/components/GuideBadgesSection";
import type { BadgeRecord } from "@/lib/badges/insert-badge";
import ThemedSelect from "@/components/ThemedSelect";

interface TrainingTrack {
  id: string
  title: string
  tpa_name: string
  track_type: string
  is_archived: boolean
  price_myr: number
  // Bug 9: HoD-set per-module rate. Total = price_per_module * active module count.
  // NULL → legacy flat price_myr fallback.
  price_per_module: number | null
  module_count?: number
}

interface Module {
  id: string
  track_id: string
  title: string
  is_active: boolean
  is_archived: boolean
  additional_track_ids: string[]
  created_at: string
  training_tracks?: {
    id: string
    title: string
    tpa_name: string
    track_type: string
  } | null
}

interface ModuleVersion {
  id: string
  module_id: string
  version_number: number
  change_type: 'create' | 'update' | 'rollback'
  title: string
  track_id: string
  order_index: number
  duration_hours: number
  is_active: boolean
  edited_by: string
  editor_name: string
  editor_role: string
  created_at: string
  training_tracks?: { title: string; tpa_name: string } | null
  training_modules?: { title: string } | null
}

interface Application {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  tpa_name: string;
  motivation: string;
  experience: string;
  status: "PENDING" | "UNDER_REVIEW" | "INTERVIEW_SCHEDULED" | "APPROVED" | "REJECTED";
  reviewer_notes: string;
  submitted_at: string;
  reviewed_at: string | null;
  // Task 7 — interview fields
  interview_date: string | null;
  interview_time: string | null;
  interview_location: string | null;
  document_count: number;
  training_tracks: { title: string } | null;
}

const FEED_ITEMS = [
  {
    id: 1,
    icon: "report_problem",
    iconBg: "bg-red-100",
    iconColor: "text-red-700",
    fill: false,
    title: "Unsanctioned Movement Detected",
    time: "02 MIN AGO",
    body: "Grid 42-B. 3 individuals without active permits. Ranger team dispatching.",
    action: "Assign Guide",
  },
  {
    id: 2,
    icon: "school",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-800",
    fill: true,
    title: "Module Completion: Advanced Tracking",
    time: "14 MIN AGO",
    body: "Ahmad bin Yusuf (Ranger ID: SFC-771) has completed the certification.",
    action: "Verify Bio",
  },
  {
    id: 3,
    icon: "info",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-800",
    fill: false,
    title: "System Update: Biodiversity 2.4",
    time: "1 HOUR AGO",
    body: "New AR overlays added for orchid identification in Guide Track.",
    action: "Release Notes",
  },
]

const PATROL_MEMBERS = [
  { name: "Ahmad bin Yusuf", track: "Bako NP — Zone Alpha", progress: 78 },
  { name: "Siti Aminah", track: "Kubah NP — Zone Bravo", progress: 55 },
  { name: "James Masing", track: "Gunung Mulu — Zone Delta", progress: 92 },
]

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const moduleId = searchParams.get('id')
  const action = searchParams.get('action') || 'overview'

  const [userRole, setUserRole] = useState<AppRole>("GUIDE");
  const [loading, setLoading] = useState(true);

  // Training modules state
  const [modules, setModules] = useState<Module[]>([])
  const [trainingTracks, setTrainingTracks] = useState<TrainingTrack[]>([])
  const [selectedTpa, setSelectedTpa] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

  // Module version history state
  const [moduleVersions, setModuleVersions] = useState<ModuleVersion[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Archive panel toggles
  const [showArchivedTracks, setShowArchivedTracks] = useState(false)
  const [showArchivedModules, setShowArchivedModules] = useState(false)

  // Park Badge (track) CRUD state
  const [trackModalOpen, setTrackModalOpen] = useState(false)
  const [editingTrack, setEditingTrack] = useState<TrainingTrack | null>(null)
  const [trackForm, setTrackForm] = useState<{
    title: string
    tpa_name: string
    track_type: string
    price_myr: number
    price_per_module: number | null
  }>({ title: '', tpa_name: '', track_type: 'GUIDE', price_myr: 7800, price_per_module: null })
  const [trackSaving, setTrackSaving] = useState(false)
  const [trackToast, setTrackToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Certification badges state (B7.4)
  const [badges, setBadges] = useState<BadgeRecord[]>([])
  const [badgesLoading, setBadgesLoading] = useState(false)

  // Applications state
  const [applications, setApplications] = useState<Application[]>([])
  const [appTab, setAppTab] = useState<Application['status']>("PENDING")
  const [expandedApp, setExpandedApp] = useState<string | null>(null)
  const [appNotes, setAppNotes] = useState<Record<string, string>>({})
  const [processingApp, setProcessingApp] = useState<string | null>(null)
  const [appToast, setAppToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // General modules state (HoD)
  const [generalModules, setGeneralModules] = useState<{ id: string; title: string; description: string; content: string; tpa_ids: string[]; order_index: number; duration_hours: number; is_active: boolean }[]>([])
  const [gmLoading, setGmLoading] = useState(false)
  const [gmSaving, setGmSaving] = useState(false)
  const [gmLoaded, setGmLoaded] = useState(false)
  const [gmToast, setGmToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!error && profile?.role) {
        setUserRole(profile.role as AppRole);
      } else {
        setUserRole((user.user_metadata?.role ?? "GUIDE") as AppRole);
      }

      if (hasMinRole(profile?.role as AppRole, "GUIDE")) {
        await loadTrainingModulesData()
        await loadBadgesData(user.id)
      }
      if (hasMinRole(profile?.role as AppRole, "HOD")) {
        await loadApplicationsData()
        await loadModuleHistory()
      }

      setLoading(false);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTrainingModulesData = async () => {
    try {
      const { data: tracks, error: tracksError } = await supabase
        .from('training_tracks')
        .select('id, title, tpa_name, track_type, is_archived, price_myr, price_per_module')
        .order('tpa_name')

      if (tracksError) throw tracksError

      const { data: mods, error: modsError } = await supabase
        .from('training_modules')
        .select('id, track_id, title, is_active, is_archived, additional_track_ids, created_at, training_tracks(id, title, tpa_name, track_type)')
        .order('order_index')

      if (modsError) throw modsError

      // Bug 9: derive module_count per track for pricing display
      const modList = (mods || []) as unknown as Module[]
      const countByTrack = modList.reduce<Record<string, number>>((acc, m) => {
        if (!m.is_archived && m.is_active) acc[m.track_id] = (acc[m.track_id] ?? 0) + 1
        return acc
      }, {})
      const enriched = (tracks || []).map(t => ({
        ...(t as Record<string, unknown>),
        module_count: countByTrack[(t as { id: string }).id] ?? 0,
      })) as unknown as TrainingTrack[]

      setTrainingTracks(enriched)
      setModules(modList)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load training modules data'
      setError(message)
    }
  }

  const loadBadgesData = async (uid: string) => {
    setBadgesLoading(true)
    try {
      const { data, error } = await supabase
        .from('guide_badges')
        .select('*, training_tracks(title, tpa_name)')
        .eq('guide_id', uid)
        .order('issue_date', { ascending: false })
      if (error) console.error('[badges] failed to load:', error.message)
      else setBadges((data ?? []) as BadgeRecord[])
    } finally {
      setBadgesLoading(false)
    }
  }

  const loadApplicationsData = async () => {
    try {
      const { data } = await supabase
        .from("guide_applications")
        .select("*, training_tracks(title)")
        .order("submitted_at", { ascending: false });
      setApplications((data as Application[]) ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load applications data'
      setError(message)
    }
  }

  const loadModuleHistory = async () => {
    setHistoryLoading(true)
    try {
      const { data, error } = await supabase
        .from('training_module_versions')
        .select('id, module_id, version_number, change_type, title, track_id, order_index, duration_hours, is_active, edited_by, editor_name, editor_role, created_at, training_tracks(title, tpa_name), training_modules(title)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (!error) setModuleVersions((data || []) as unknown as ModuleVersion[])
    } finally {
      setHistoryLoading(false)
    }
  }

  // ── General modules CRUD (HoD) ─────────────────────────────────────────────
  const loadGeneralModules = async () => {
    setGmLoading(true)
    try {
      const res = await fetch('/api/general-modules', { cache: 'no-store' })
      const body = await res.json()
      if (res.ok) setGeneralModules(body.modules ?? [])
      setGmLoaded(true)
    } finally {
      setGmLoading(false)
    }
  }

  function showGmToast(msg: string, ok: boolean) {
    setGmToast({ msg, ok })
    setTimeout(() => setGmToast(null), 4000)
  }

  async function handleGmCreate(data: GeneralModuleEditorState) {
    setGmSaving(true)
    try {
      const res = await fetch('/api/general-modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title.trim(),
          description: data.description.trim(),
          content: data.content,
          tpa_ids: data.tpa_ids,
          order_index: data.order_index,
          duration_hours: data.duration_hours,
          is_active: data.is_active,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setGmLoaded(false)
      router.push('/dashboard?action=general-modules')
    } finally {
      setGmSaving(false)
    }
  }

  async function handleGmUpdate(data: GeneralModuleEditorState) {
    if (!data.id) return
    setGmSaving(true)
    try {
      const res = await fetch(`/api/general-modules/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title.trim(),
          description: data.description.trim(),
          content: data.content,
          tpa_ids: data.tpa_ids,
          order_index: data.order_index,
          duration_hours: data.duration_hours,
          is_active: data.is_active,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setGmLoaded(false)
      router.push('/dashboard?action=general-modules')
    } finally {
      setGmSaving(false)
    }
  }

  async function handleGmDelete(id: string) {
    if (!confirm('Delete this general module? This cannot be undone.')) return
    const res = await fetch(`/api/general-modules/${id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); showGmToast(d.error || 'Delete failed.', false); return }
    showGmToast('Module deleted.', true)
    await loadGeneralModules()
  }

  function openCreateTrack() {
    setEditingTrack(null)
    setTrackForm({ title: '', tpa_name: '', track_type: 'GUIDE', price_myr: 7800, price_per_module: null })
    setTrackModalOpen(true)
  }

  function openEditTrack(track: TrainingTrack) {
    setEditingTrack(track)
    setTrackForm({
      title: track.title,
      tpa_name: track.tpa_name,
      track_type: track.track_type,
      price_myr: track.price_myr ?? 7800,
      price_per_module: track.price_per_module ?? null,
    })
    setTrackModalOpen(true)
  }

  async function handleSaveTrack() {
    if (!trackForm.title.trim() || !trackForm.tpa_name.trim()) {
      setTrackToast({ msg: 'Badge name and TPA are required.', ok: false })
      setTimeout(() => setTrackToast(null), 4000)
      return
    }
    setTrackSaving(true)
    try {
      const payload = {
        title: trackForm.title.trim(),
        tpa_name: trackForm.tpa_name.trim(),
        track_type: trackForm.track_type,
        price_myr: trackForm.price_myr,
        price_per_module: trackForm.price_per_module,
      }
      if (editingTrack) {
        const { error } = await supabase
          .from('training_tracks')
          .update(payload)
          .eq('id', editingTrack.id)
        if (error) throw error
        setTrainingTracks(prev => prev.map(t => t.id === editingTrack.id ? { ...t, ...trackForm } : t))
        setTrackToast({ msg: 'Park Badge updated.', ok: true })
      } else {
        const { data: newTrack, error } = await supabase
          .from('training_tracks')
          .insert(payload)
          .select('id, title, tpa_name, track_type, is_archived, price_myr, price_per_module')
          .single()
        if (error) throw error
        setTrainingTracks(prev => [...prev, { ...(newTrack as unknown as TrainingTrack), module_count: 0 }])
        setTrackToast({ msg: 'Park Badge created.', ok: true })
      }
      setTrackModalOpen(false)
    } catch (err) {
      setTrackToast({ msg: err instanceof Error ? err.message : 'Save failed.', ok: false })
    } finally {
      setTrackSaving(false)
      setTimeout(() => setTrackToast(null), 4000)
    }
  }

  async function handleArchiveTrack(id: string) {
    if (!confirm('Archive this Park Badge? Modules with only this badge will also be archived. Modules with multiple badges will have this one removed.')) return
    const { error } = await supabase.from('training_tracks').update({ is_archived: true }).eq('id', id)
    if (error) { setTrackToast({ msg: error.message, ok: false }); setTimeout(() => setTrackToast(null), 4000); return }

    const primaryMods = modules.filter(m => m.track_id === id && !m.is_archived)
    for (const mod of primaryMods) {
      const extra = (mod.additional_track_ids || []).filter(tid => tid !== id)
      if (extra.length === 0) {
        await supabase.from('training_modules').update({ is_archived: true }).eq('id', mod.id)
      } else {
        await supabase.from('training_modules').update({ track_id: extra[0], additional_track_ids: extra.slice(1) }).eq('id', mod.id)
      }
    }
    const extraMods = modules.filter(m => (m.additional_track_ids || []).includes(id))
    for (const mod of extraMods) {
      const newExtra = (mod.additional_track_ids || []).filter(tid => tid !== id)
      await supabase.from('training_modules').update({ additional_track_ids: newExtra }).eq('id', mod.id)
    }

    await loadTrainingModulesData()
    setTrackToast({ msg: 'Park Badge archived.', ok: true })
    setTimeout(() => setTrackToast(null), 4000)
  }

  async function handleUnarchiveTrack(id: string) {
    const { error } = await supabase.from('training_tracks').update({ is_archived: false }).eq('id', id)
    if (error) { setTrackToast({ msg: error.message, ok: false }); setTimeout(() => setTrackToast(null), 4000); return }
    const archivedPrimary = modules.filter(m => m.track_id === id && m.is_archived)
    for (const mod of archivedPrimary) {
      await supabase.from('training_modules').update({ is_archived: false }).eq('id', mod.id)
    }
    await loadTrainingModulesData()
    setTrackToast({ msg: 'Park Badge restored. Related modules also restored.', ok: true })
    setTimeout(() => setTrackToast(null), 4000)
  }

  const handleCreateModule = async (data: ModuleEditorState) => {
    try {
      setIsSaving(true)
      setError(null)

      const { data: newModule, error } = await supabase
        .from('training_modules')
        .insert({
          track_id: data.track_id,
          additional_track_ids: data.additional_track_ids,
          title: data.title,
          description: data.description,
          content: data.content,
          order_index: data.order_index,
          duration_hours: data.duration_hours,
          is_active: data.is_active,
        })
        .select('id, track_id, additional_track_ids, is_archived, title, is_active, created_at, training_tracks(id, title, tpa_name, track_type)')
        .single()

      if (error) throw error

      setModules((prev) => [ ...prev, newModule as unknown as Module])
      router.push('/dashboard?action=modules')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create module'
      setError(message)
      throw err
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateModule = async (data: ModuleEditorState) => {
    if (!moduleId) return

    try {
      setIsSaving(true)
      setError(null)

      const { data: updatedModule, error } = await supabase
        .from('training_modules')
        .update({
          track_id: data.track_id,
          additional_track_ids: data.additional_track_ids,
          title: data.title,
          description: data.description,
          content: data.content,
          order_index: data.order_index,
          duration_hours: data.duration_hours,
          is_active: data.is_active,
        })
        .eq('id', moduleId)
        .select('id, track_id, additional_track_ids, is_archived, title, is_active, created_at, training_tracks(id, title, tpa_name, track_type)')
        .single()

      if (error) throw error

      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId
            ? {
                ...m,
                title: updatedModule?.title || m.title,
                is_active: updatedModule?.is_active ?? m.is_active,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                additional_track_ids: (updatedModule as any)?.additional_track_ids ?? m.additional_track_ids,
                training_tracks: (updatedModule?.training_tracks ?? m.training_tracks) as unknown as Module['training_tracks'],
              }
            : m
        )
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update module'
      setError(message)
      throw err
    } finally {
      setIsSaving(false)
    }
  }

  const handleHistoryRollback = async () => {
    if (!moduleId) return

    try {
      setHistoryError(null)
      const response = await fetch(`/api/training-modules/${moduleId}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const body = await response.json()
      if (!response.ok) {
        throw new Error(body?.error || 'Failed to rollback module version')
      }

      await loadTrainingModulesData()
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rollback failed'
      setHistoryError(message)
    }
  }

  const handleArchiveModule = async (id: string) => {
    if (!confirm('Archive this module? You can restore it later.')) return
    try {
      setError(null)
      const { error } = await supabase.from('training_modules').update({ is_archived: true }).eq('id', id)
      if (error) throw error
      setModules(prev => prev.map(m => m.id === id ? { ...m, is_archived: true } : m))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive module')
    }
  }

  const handleRestoreModule = async (id: string) => {
    try {
      setError(null)
      const { error } = await supabase.from('training_modules').update({ is_archived: false }).eq('id', id)
      if (error) throw error
      setModules(prev => prev.map(m => m.id === id ? { ...m, is_archived: false } : m))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore module')
    }
  }

  const handleDeleteModule = async (id: string) => {
    if (!confirm('Permanently delete this module? This cannot be undone.')) return
    try {
      setError(null)
      const { error } = await supabase.from('training_modules').delete().eq('id', id)
      if (error) throw error
      setModules(prev => prev.filter(m => m.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete module')
    }
  }

  async function handleDeleteTrack(id: string) {
    if (!confirm('Permanently delete this Park Badge? This cannot be undone.')) return
    const { error } = await supabase.from('training_tracks').delete().eq('id', id)
    if (error) { setTrackToast({ msg: error.message, ok: false }); setTimeout(() => setTrackToast(null), 4000); return }
    setTrainingTracks(prev => prev.filter(t => t.id !== id))
    setTrackToast({ msg: 'Park Badge deleted.', ok: true })
    setTimeout(() => setTrackToast(null), 4000)
  }

  const handleApproveApplication = async (appId: string) => {
    setProcessingApp(appId);
    const res = await fetch(`/api/applications/${appId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: appNotes[appId] ?? '' }),
    });
    setProcessingApp(null);
    if (!res.ok) { const d = await res.json(); showAppToast(d.error, false); return; }
    showAppToast("Application approved. Role upgraded to Guide.", true);
    setExpandedApp(null);
    await loadApplicationsData();
  }

  const handleRejectApplication = async (appId: string) => {
    if (!appNotes[appId]?.trim()) { showAppToast("Rejection notes are required.", false); return; }
    setProcessingApp(appId);
    const res = await fetch(`/api/applications/${appId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: appNotes[appId].trim() }),
    });
    setProcessingApp(null);
    if (!res.ok) { const d = await res.json(); showAppToast(d.error, false); return; }
    showAppToast("Application rejected.", true);
    setExpandedApp(null);
    await loadApplicationsData();
  }

  function showAppToast(msg: string, ok: boolean) {
    setAppToast({ msg, ok });
    setTimeout(() => setAppToast(null), 4000);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
      </div>
    );
  }

  // Training Modules Edit View
  if (hasMinRole(userRole, 'HOD') && action === 'edit' && moduleId) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.push('/dashboard?action=modules')}
            className="mb-6 text-[#2D6A3F] hover:text-[#1B3A24] font-medium flex items-center gap-2"
          >
            ← Back to Modules
          </button>

          <div className="bg-white rounded-lg p-8 shadow-sm">
            <ModuleEditorForm
              moduleId={moduleId}
              onSubmit={handleUpdateModule}
              onCancel={() => router.push('/dashboard?action=modules')}
              isLoading={isSaving}
              trainingTracks={trainingTracks.filter(t => !t.is_archived)}
            />
          </div>

          <div className="mt-6 bg-white rounded-lg p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-[#1B3A24] mb-4">Module History</h2>
            <ModuleHistoryPanel moduleId={moduleId} onRollback={handleHistoryRollback} />
            {historyError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {historyError}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Training Modules Create View
  if (hasMinRole(userRole, 'HOD') && action === 'new') {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.push('/dashboard?action=modules')}
            className="mb-6 text-[#2D6A3F] hover:text-[#1B3A24] font-medium flex items-center gap-2"
          >
            ← Back to Modules
          </button>

          <div className="bg-white rounded-lg p-8 shadow-sm">
            <ModuleEditorForm
              onSubmit={handleCreateModule}
              onCancel={() => router.push('/dashboard?action=modules')}
              isLoading={isSaving}
              trainingTracks={trainingTracks.filter(t => !t.is_archived)}
            />
          </div>
        </div>
      </div>
    )
  }

  // Redirect non-HOD guides to their dedicated pages
  if (hasMinRole(userRole, 'GUIDE') && !hasMinRole(userRole, 'HOD') && action === 'modules') {
    router.replace('/training/modules')
    return null
  }
  if (hasMinRole(userRole, 'GUIDE') && !hasMinRole(userRole, 'HOD') && action === 'tracks') {
    router.replace('/training/tracks')
    return null
  }

  // General Modules — Edit View
  if (hasMinRole(userRole, 'HOD') && action === 'gm-edit' && moduleId) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.push('/dashboard?action=general-modules')}
            className="mb-6 text-[#2D6A3F] hover:text-[#1B3A24] font-medium flex items-center gap-2"
          >
            ← Back to General Modules
          </button>
          <div className="bg-white rounded-lg p-8 shadow-sm">
            <GeneralModuleEditorForm
              moduleId={moduleId}
              onSubmit={handleGmUpdate}
              onCancel={() => router.push('/dashboard?action=general-modules')}
              isLoading={gmSaving}
              trainingTracks={trainingTracks.filter(t => !t.is_archived)}
            />
          </div>
        </div>
      </div>
    )
  }

  // General Modules — Create View
  if (hasMinRole(userRole, 'HOD') && action === 'gm-new') {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.push('/dashboard?action=general-modules')}
            className="mb-6 text-[#2D6A3F] hover:text-[#1B3A24] font-medium flex items-center gap-2"
          >
            ← Back to General Modules
          </button>
          <div className="bg-white rounded-lg p-8 shadow-sm">
            <GeneralModuleEditorForm
              onSubmit={handleGmCreate}
              onCancel={() => router.push('/dashboard?action=general-modules')}
              isLoading={gmSaving}
              trainingTracks={trainingTracks.filter(t => !t.is_archived)}
            />
          </div>
        </div>
      </div>
    )
  }

  // General Modules — List View (HoD)
  if (hasMinRole(userRole, 'HOD') && action === 'general-modules') {
    if (!gmLoaded && !gmLoading) loadGeneralModules()

    return (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-6xl mx-auto">
          {gmToast && (
            <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white ${gmToast.ok ? 'bg-emerald-700' : 'bg-red-700'}`}>
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{gmToast.ok ? 'check_circle' : 'error'}</span>
              {gmToast.msg}
            </div>
          )}

          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#1B3A24] mb-2">General Training Modules</h1>
              <p className="text-[#64748b]">
                Park-agnostic modules all guides must complete before TPA enrolment.
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard?action=gm-new')}
              className="px-6 py-2.5 bg-[#2D6A3F] text-white font-medium rounded-lg hover:bg-[#1B3A24] transition-colors flex items-center gap-2"
            >
              ✨ Create New Module
            </button>
          </div>

          {gmLoading ? (
            <div className="bg-white rounded-lg p-12 text-center shadow-sm">
              <span className="material-symbols-outlined animate-spin text-[#2D6A3F] text-3xl">progress_activity</span>
              <p className="text-sm text-[#64748b] mt-2">Loading general modules…</p>
            </div>
          ) : generalModules.length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center shadow-sm">
              <div className="text-4xl mb-3">📚</div>
              <h3 className="text-lg font-semibold text-[#1B3A24] mb-1">No modules yet</h3>
              <p className="text-[#64748b] mb-6">Create your first general training module to get started</p>
              <button onClick={() => router.push('/dashboard?action=gm-new')} className="px-6 py-2.5 bg-[#2D6A3F] text-white font-medium rounded-lg hover:bg-[#1B3A24]">Create Module</button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">#</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Module Title</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Description</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">TPAs</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-[#1B3A24]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {generalModules.map((m, idx) => (
                    <tr key={m.id} className={`border-b border-[#e2e8f0] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
                      <td className="px-4 sm:px-6 py-4">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-black">{m.order_index + 1}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-4"><p className="font-medium text-[#1B3A24]">{m.title}</p></td>
                      <td className="px-4 sm:px-6 py-4"><p className="text-sm text-[#475569] line-clamp-2">{m.description || '—'}</p></td>
                      <td className="px-4 sm:px-6 py-4">
                        {m.tpa_ids.length === 0 ? (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">All TPAs</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {m.tpa_ids.map(tid => {
                              const track = trainingTracks.find(t => t.id === tid)
                              return (
                                <span key={tid} className="inline-block px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded">
                                  {track ? track.tpa_name : tid.slice(0, 8)}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {m.is_active ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => router.push(`/dashboard?action=gm-edit&id=${m.id}`)} className="px-3 py-1 text-sm font-medium text-[#2D6A3F] hover:bg-[#f0f4f8] rounded transition-colors">✎ Edit</button>
                          <button onClick={() => handleGmDelete(m.id)} className="px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 rounded transition-colors">🗑 Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Modules list (HoD)
  if (hasMinRole(userRole, 'GUIDE') && action === 'modules') {
    const isHodView = hasMinRole(userRole, 'HOD')
    const activeModules = modules.filter(m => !m.is_archived)
    const archivedModules = modules.filter(m => m.is_archived)
    const filteredModules = selectedTpa
      ? activeModules.filter(m => {
          const primaryMatch = m.training_tracks?.tpa_name === selectedTpa
          const additionalMatch = (m.additional_track_ids || []).some(tid => trainingTracks.find(t => t.id === tid)?.tpa_name === selectedTpa)
          return primaryMatch || additionalMatch
        })
      : activeModules
    const uniqueTpas = Array.from(new Set(trainingTracks.filter(t => !t.is_archived).map(t => t.tpa_name)))

    return (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#1B3A24] mb-2">Training Modules</h1>
              <p className="text-[#64748b]">
                {isHodView ? 'Manage training modules for all certification tracks' : 'Browse available training modules for your Park Badge'}
              </p>
            </div>
            {isHodView && (
              <div className="flex items-center gap-3">
                <button onClick={() => setShowArchivedModules(v => !v)}
                  className="px-4 py-2.5 border border-gray-200 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">inventory_2</span>
                  Archived ({archivedModules.length})
                </button>
                <button onClick={() => router.push('/dashboard?action=new')}
                  className="px-6 py-2.5 bg-[#2D6A3F] text-white font-medium rounded-lg hover:bg-[#1B3A24] transition-colors flex items-center gap-2">
                  ✨ Create New Module
                </button>
              </div>
            )}
          </div>

          <div className="mb-6 flex items-center gap-3">
            <label className="text-sm font-semibold text-[#1B3A24]">Filter by Park Badge</label>
            <ThemedSelect
              value={selectedTpa}
              onChange={v => setSelectedTpa(v)}
              options={[
                { value: '', label: 'All Park Badges' },
                ...uniqueTpas.map(tpa => ({ value: tpa, label: tpa })),
              ]}
            />
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {modules.length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center shadow-sm">
              <div className="text-4xl mb-3">📚</div>
              <h3 className="text-lg font-semibold text-[#1B3A24] mb-1">No modules yet</h3>
              {isHodView ? (
                <>
                  <p className="text-[#64748b] mb-6">Create your first training module to get started</p>
                  <button onClick={() => router.push('/dashboard?action=new')} className="px-6 py-2.5 bg-[#2D6A3F] text-white font-medium rounded-lg hover:bg-[#1B3A24]">Create Module</button>
                </>
              ) : (
                <p className="text-[#64748b]">No training modules are available yet. Check back later.</p>
              )}
            </div>
          ) : filteredModules.length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center shadow-sm">
              <div className="text-4xl mb-3">🔎</div>
              <h3 className="text-lg font-semibold text-[#1B3A24] mb-1">No modules found</h3>
              <p className="text-[#64748b]">No modules matching the selected Park Badge. Clear the filter or select another.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Module Title</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Park Badge / TPA</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Created</th>
                    {isHodView && <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-[#1B3A24]">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredModules.map((module, idx) => {
                    const additionalTracks = (module.additional_track_ids || []).map(tid => trainingTracks.find(t => t.id === tid)).filter(Boolean)
                    return (
                      <tr key={module.id} className={`border-b border-[#e2e8f0] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
                        <td className="px-4 sm:px-6 py-4"><p className="font-medium text-[#1B3A24]">{module.title}</p></td>
                        <td className="px-4 sm:px-6 py-4 text-sm text-[#475569]">
                          <p className="font-medium">{module.training_tracks?.title || 'Unknown'}</p>
                          <p className="text-xs text-[#64748b]">{module.training_tracks?.tpa_name || 'Unknown'}</p>
                          {additionalTracks.map(t => t && (
                            <p key={t.id} className="text-xs text-blue-600 mt-0.5">+ {t.tpa_name}</p>
                          ))}
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <span className={module.is_active ? 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800' : 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800'}>
                            {module.is_active ? 'Published' : '⊝ Draft'}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4"><p className="text-sm text-[#64748b]">{new Date(module.created_at).toLocaleDateString()}</p></td>
                        {isHodView && (
                          <td className="px-4 sm:px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => router.push(`/dashboard?action=edit&id=${module.id}`)} className="px-3 py-1 text-sm font-medium text-[#2D6A3F] hover:bg-[#f0f4f8] rounded transition-colors">✎ Edit</button>
                              <button onClick={() => handleArchiveModule(module.id)} className="px-3 py-1 text-sm font-medium text-amber-600 hover:bg-amber-50 rounded transition-colors">📦 Archive</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {isHodView && showArchivedModules && (
            <div className="mt-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">inventory_2</span>Archived Modules
              </h3>
              {archivedModules.length === 0 ? (
                <p className="text-sm text-gray-400 bg-white rounded-lg p-6 text-center">No archived modules.</p>
              ) : (
                <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-dashed border-gray-300">
                  <table className="w-full">
                    <tbody>
                      {archivedModules.map((module, idx) => (
                        <tr key={module.id} className={`border-b border-[#e2e8f0] opacity-60 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
                          <td className="px-6 py-3"><p className="text-sm font-medium text-gray-500 line-through">{module.title}</p></td>
                          <td className="px-6 py-3 text-xs text-gray-400">{module.training_tracks?.tpa_name || '—'}</td>
                          <td className="px-6 py-3 text-xs text-gray-400">{new Date(module.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleRestoreModule(module.id)} className="px-3 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded transition-colors flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">restore</span>Restore
                              </button>
                              <button onClick={() => handleDeleteModule(module.id)} className="px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">delete</span>Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Park Badges CRUD View (HoD)
  if (hasMinRole(userRole, 'HOD') && action === 'tracks') {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-6xl mx-auto">
          {trackToast && (
            <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white ${trackToast.ok ? 'bg-emerald-700' : 'bg-red-700'}`}>
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{trackToast.ok ? 'check_circle' : 'error'}</span>
              {trackToast.msg}
            </div>
          )}

          {trackModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
                <h2 className="text-xl font-bold text-[#1B3A24] mb-6">{editingTrack ? 'Edit Park Badge' : 'Create Park Badge'}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">Badge Name</label>
                    <input
                      type="text"
                      value={trackForm.title}
                      onChange={e => setTrackForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Bako National Park Guide Badge"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">Totally Protected Area (TPA)</label>
                    <input
                      type="text"
                      value={trackForm.tpa_name}
                      onChange={e => setTrackForm(f => ({ ...f, tpa_name: e.target.value }))}
                      placeholder="e.g. Bako National Park"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Guides certified under this badge can only operate in this TPA.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">Price per Module (RM)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">RM</span>
                      <input
                        type="number"
                        min={0}
                        value={trackForm.price_per_module ?? ''}
                        placeholder="e.g. 500"
                        onChange={e => {
                          const raw = e.target.value
                          setTrackForm(f => ({
                            ...f,
                            price_per_module: raw === '' ? null : Math.max(1, parseInt(raw) || 0),
                          }))
                        }}
                        className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#012d1d]/20 focus:border-[#012d1d] transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Total activation fee = this rate × number of active modules. Leave blank to use the flat fallback below.
                    </p>
                    {trackForm.price_per_module != null && editingTrack && (
                      <p className="text-[11px] text-emerald-700 mt-1">
                        Preview: {editingTrack.module_count ?? 0} modules × RM {trackForm.price_per_module}
                        = RM {((editingTrack.module_count ?? 0) * trackForm.price_per_module).toLocaleString('en-MY')}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">Legacy Flat Price (RM)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">RM</span>
                      <input
                        type="number"
                        min={1}
                        value={trackForm.price_myr}
                        onChange={e => setTrackForm(f => ({ ...f, price_myr: Math.max(1, parseInt(e.target.value) || 0) }))}
                        className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#012d1d]/20 focus:border-[#012d1d] transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Used only when Price per Module is blank.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">Badge Type</label>
                    <div className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-[#f8fafc] text-gray-500">Guide Track</div>
                  </div>
                </div>
                <div className="flex gap-3 justify-end mt-8">
                  <button onClick={() => setTrackModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">Cancel</button>
                  <button onClick={handleSaveTrack} disabled={trackSaving}
                    className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-[#024a2f] transition-all disabled:opacity-50 flex items-center gap-2">
                    {trackSaving && <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>}
                    {editingTrack ? 'Save Changes' : 'Create Badge'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#1B3A24] mb-1">Park Badges Tracking</h1>
              <p className="text-[#64748b]">Each badge is tied to one TPA — certification is non-transferable between parks.</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowArchivedTracks(v => !v)}
                className="px-4 py-2.5 border border-gray-200 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                <span className="material-symbols-outlined text-base">inventory_2</span>
                Archived ({trainingTracks.filter(t => t.is_archived).length})
              </button>
              <button onClick={openCreateTrack}
                className="px-6 py-2.5 bg-[#2D6A3F] text-white font-medium rounded-lg hover:bg-[#1B3A24] transition-colors flex items-center gap-2">
                🏅 Create Park Badge
              </button>
            </div>
          </div>

          {trainingTracks.filter(t => !t.is_archived).length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center shadow-sm">
              <div className="text-4xl mb-3">🏅</div>
              <h3 className="text-lg font-semibold text-[#1B3A24] mb-1">No active Park Badges</h3>
              <p className="text-[#64748b] mb-6">Create your first badge to start certifying guides for a specific park.</p>
              <button onClick={openCreateTrack} className="px-6 py-2.5 bg-[#2D6A3F] text-white font-medium rounded-lg hover:bg-[#1B3A24]">Create Badge</button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-x-auto mb-6">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Badge Name</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">TPA (Park)</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Activation Price</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Type</th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-[#1B3A24]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingTracks.filter(t => !t.is_archived).map((track, idx) => (
                    <tr key={track.id} className={`border-b border-[#e2e8f0] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
                      <td className="px-6 py-4"><div className="flex items-center gap-2"><span className="text-lg">🏅</span><p className="font-medium text-[#1B3A24]">{track.title}</p></div></td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="material-symbols-outlined text-sm">location_on</span>{track.tpa_name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {track.price_per_module != null ? (
                          <div>
                            <span className="font-semibold text-[#1B3A24] text-sm">
                              RM {((track.module_count ?? 0) * track.price_per_module).toLocaleString('en-MY')}
                            </span>
                            <span className="block text-[11px] text-gray-400">
                              {track.module_count ?? 0} mod × RM {track.price_per_module}
                            </span>
                          </div>
                        ) : (
                          <span className="font-semibold text-[#1B3A24] text-sm">
                            RM {(track.price_myr ?? 7800).toLocaleString('en-MY')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4"><span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800">🧭 Guide</span></td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEditTrack(track)} className="px-3 py-1 text-sm font-medium text-[#2D6A3F] hover:bg-[#f0f4f8] rounded transition-colors">✎ Edit</button>
                          <button onClick={() => handleArchiveTrack(track.id)} className="px-3 py-1 text-sm font-medium text-amber-600 hover:bg-amber-50 rounded transition-colors">📦 Archive</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showArchivedTracks && (
            <div className="mt-2">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">inventory_2</span>Archived Park Badges
              </h3>
              {trainingTracks.filter(t => t.is_archived).length === 0 ? (
                <p className="text-sm text-gray-400 bg-white rounded-lg p-6 text-center">No archived badges.</p>
              ) : (
                <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-dashed border-gray-300">
                  <table className="w-full">
                    <tbody>
                      {trainingTracks.filter(t => t.is_archived).map((track, idx) => (
                        <tr key={track.id} className={`border-b border-[#e2e8f0] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'} opacity-60`}>
                          <td className="px-6 py-3"><div className="flex items-center gap-2"><span className="text-base">🏅</span><p className="text-sm font-medium text-gray-500 line-through">{track.title}</p></div></td>
                          <td className="px-6 py-3 text-xs text-gray-400">{track.tpa_name}</td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleUnarchiveTrack(track.id)} className="px-3 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded transition-colors flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">restore</span>Restore
                              </button>
                              <button onClick={() => handleDeleteTrack(track.id)} className="px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">delete</span>Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Module History View
  if (hasMinRole(userRole, 'HOD') && action === 'module-history') {
    const CHANGE_BADGE: Record<string, { label: string; color: string }> = {
      create:   { label: 'Created',  color: 'bg-emerald-100 text-emerald-800' },
      update:   { label: 'Updated',  color: 'bg-blue-100 text-blue-800' },
      rollback: { label: 'Rollback', color: 'bg-amber-100 text-amber-800' },
    }

    return (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#1B3A24] mb-1">Module Edit History</h1>
            <p className="text-[#64748b]">Audit log of all training module changes.</p>
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-20">
              <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
            </div>
          ) : moduleVersions.length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center shadow-sm">
              <div className="text-4xl mb-3">📋</div>
              <h3 className="text-lg font-semibold text-[#1B3A24] mb-1">No history yet</h3>
              <p className="text-[#64748b]">Module edits will appear here once any training module is created or modified.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
              <table className="w-full min-w-[768px]">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Module</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Park Badge / TPA</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Change</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Editor</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Role</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Timestamp</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Ver.</th>
                  </tr>
                </thead>
                <tbody>
                  {moduleVersions.map((v, idx) => {
                    const badge = CHANGE_BADGE[v.change_type] ?? { label: v.change_type, color: 'bg-gray-100 text-gray-700' }
                    return (
                      <tr key={v.id} className={`border-b border-[#e2e8f0] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
                        <td className="px-6 py-4">
                          <p className="font-medium text-[#1B3A24] text-sm">{(v.training_modules as unknown as { title: string } | null)?.title || v.title}</p>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <p className="font-medium text-[#475569]">{v.training_tracks?.title || '—'}</p>
                          <p className="text-xs text-[#64748b]">{v.training_tracks?.tpa_name || '—'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${badge.color}`}>{badge.label}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#1B3A24] font-medium">{v.editor_name || '—'}</td>
                        <td className="px-6 py-4">
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{v.editor_role}</span>
                        </td>
                        <td className="px-6 py-4 text-xs text-[#64748b]">
                          {new Date(v.created_at).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 text-xs text-[#64748b] font-mono">v{v.version_number}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Applications View (HoD)
  if (hasMinRole(userRole, 'HOD') && action === 'applications') {
    const filteredApps = applications.filter(a => a.status === appTab);
    const appCounts: Record<Application['status'], number> = {
      PENDING:             applications.filter(a => a.status === "PENDING").length,
      UNDER_REVIEW:        applications.filter(a => a.status === "UNDER_REVIEW").length,
      INTERVIEW_SCHEDULED: applications.filter(a => a.status === "INTERVIEW_SCHEDULED").length,
      APPROVED:            applications.filter(a => a.status === "APPROVED").length,
      REJECTED:            applications.filter(a => a.status === "REJECTED").length,
    };

    const TAB_CONFIG: Record<Application['status'], { label: string; icon: string; color: string; badge: string }> = {
      PENDING:              { label: "Pending",   icon: "hourglass_top",   color: "text-amber-700",   badge: "bg-amber-100 text-amber-800" },
      UNDER_REVIEW:         { label: "Reviewing", icon: "reviews",         color: "text-blue-700",    badge: "bg-blue-100 text-blue-800" },
      INTERVIEW_SCHEDULED:  { label: "Interview", icon: "event_available", color: "text-indigo-700",  badge: "bg-indigo-100 text-indigo-800" },
      APPROVED:             { label: "Approved",  icon: "verified",        color: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800" },
      REJECTED:             { label: "Rejected",  icon: "cancel",          color: "text-red-700",     badge: "bg-red-50 text-red-800" },
    };

    const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });

    return (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#1B3A24] mb-2">Guide Applications</h1>
            <p className="text-[#64748b]">Review, approve, or reject certification applications.</p>
          </div>

          {appToast && (
            <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white ${appToast.ok ? "bg-emerald-700" : "bg-red-700"}`}>
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{appToast.ok ? "check_circle" : "error"}</span>
              {appToast.msg}
            </div>
          )}

          <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {(["PENDING","UNDER_REVIEW","INTERVIEW_SCHEDULED","APPROVED","REJECTED"] as const).map(s => {
                const cfg = TAB_CONFIG[s]
                return (
                  <div key={s} className={`text-center px-4 py-2 rounded-xl border bg-gray-50 border-gray-200`}>
                    <p className={`text-xl font-black ${cfg.color}`}>{appCounts[s]}</p>
                    <p className="text-[10px] font-bold text-gray-500 uppercase">{cfg.label}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bug 7a: include UNDER_REVIEW and INTERVIEW_SCHEDULED tabs so scheduled interviews don't "disappear" */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto max-w-full">
            {(["PENDING","UNDER_REVIEW","INTERVIEW_SCHEDULED","APPROVED","REJECTED"] as const).map(t => {
              const cfg = TAB_CONFIG[t];
              return (
                <button key={t} onClick={() => setAppTab(t)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${appTab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                  <span className={`material-symbols-outlined text-base ${appTab === t ? cfg.color : ""}`} style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
                  {cfg.label}
                  {appCounts[t] > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${cfg.badge}`}>{appCounts[t]}</span>}
                </button>
              );
            })}
          </div>

          {filteredApps.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
              <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">inbox</span>
              <p className="font-semibold text-gray-500">No {appTab.toLowerCase()} applications</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredApps.map(app => {
                const isOpen = expandedApp === app.id;
                return (
                  <div key={app.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="flex items-center gap-4 p-5">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-black text-sm shrink-0">
                        {app.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900 text-sm">{app.full_name}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${TAB_CONFIG[app.status].badge}`}>{app.status}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">location_on</span>
                            {app.tpa_name}
                          </span>
                          {app.training_tracks && (
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">school</span>
                              {app.training_tracks.title}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">schedule</span>
                            Submitted {formatDate(app.submitted_at)}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => setExpandedApp(isOpen ? null : app.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-primary transition-colors shrink-0 px-3 py-2 rounded-lg hover:bg-gray-50">
                        {isOpen ? "Collapse" : "Review"}
                        <span className="material-symbols-outlined text-base">{isOpen ? "expand_less" : "expand_more"}</span>
                      </button>
                    </div>

                    {isOpen && (
                      <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="bg-gray-50 rounded-xl p-3">
                            <p className="font-bold text-gray-400 uppercase tracking-widest mb-1">Email</p>
                            <p className="text-gray-900 font-medium">{app.email}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-3">
                            <p className="font-bold text-gray-400 uppercase tracking-widest mb-1">Phone</p>
                            <p className="text-gray-900 font-medium">{app.phone || "—"}</p>
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Motivation</p>
                          <p className="text-sm text-gray-800 leading-relaxed">{app.motivation}</p>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Prior Experience</p>
                          <p className="text-sm text-gray-800 leading-relaxed">{app.experience}</p>
                        </div>

                        <ApplicationDocumentsPanel applicationId={app.id} />

                        {app.status !== "PENDING" && app.reviewer_notes && (
                          <div className={`rounded-xl p-4 ${app.status === "APPROVED" ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Your Notes</p>
                            <p className="text-sm text-gray-800 leading-relaxed">{app.reviewer_notes}</p>
                            <p className="text-[10px] text-gray-400 mt-2">Reviewed on {app.reviewed_at ? formatDate(app.reviewed_at) : "—"}</p>
                          </div>
                        )}

                        {(app.status === "PENDING" || app.status === "UNDER_REVIEW" || app.status === "INTERVIEW_SCHEDULED") && (
                          <div className="space-y-3 pt-1">
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1.5">
                                Notes for Applicant <span className="text-red-500 ml-1">* required for rejection</span>
                              </label>
                              <textarea
                                rows={3}
                                value={appNotes[app.id] ?? ""}
                                onChange={e => setAppNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                                placeholder="Optional for approval. Required if rejecting — explain the reason clearly."
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                              />
                            </div>

                            <InterviewScheduler
                              applicationId={app.id}
                              existing={{
                                date:     app.interview_date,
                                time:     app.interview_time,
                                location: app.interview_location,
                              }}
                              onScheduled={async () => {
                                showAppToast("Interview scheduled and applicant notified.", true)
                                setExpandedApp(null)
                                await loadApplicationsData()
                              }}
                            />

                            <div className="flex gap-3 justify-end">
                              <button onClick={() => handleRejectApplication(app.id)} disabled={processingApp === app.id}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-red-200 text-red-700 font-semibold text-sm hover:bg-red-50 transition-all disabled:opacity-50">
                                {processingApp === app.id ? <span className="material-symbols-outlined animate-spin text-base">progress_activity</span> : <span className="material-symbols-outlined text-base">cancel</span>}
                                Reject
                              </button>
                              <button onClick={() => handleApproveApplication(app.id)} disabled={processingApp === app.id}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-[#024a2f] transition-all disabled:opacity-50">
                                {processingApp === app.id ? <span className="material-symbols-outlined animate-spin text-base">progress_activity</span> : <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>}
                                Approve & Upgrade Role
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const widgetMode: 'hod' | 'guide' = hasMinRole(userRole, 'HOD') ? 'hod' : 'guide'
  const heading = hasMinRole(userRole, 'HOD')
    ? 'Training Progress — All Guides'
    : 'My Training Progress'
  const subheading = hasMinRole(userRole, 'HOD')
    ? 'Live snapshot of guide enrollments and completion rates across all parks.'
    : 'Your active park badges and module completion at a glance.'

  return (
    <>
      <section className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#1B3A24]">{heading}</h1>
          <p className="text-sm text-[#64748b] mt-1">{subheading}</p>
        </div>

        {widgetMode === 'guide' && <GeneralModulesPrereq />}

        <TrainingProgressWidget mode={widgetMode} />

        {widgetMode === 'guide' && <MyBadgesWidget />}
      </section>

      <section className="p-4 sm:p-6 lg:p-8 space-y-8">
          {/* B7.4 — Certification badges (GUIDE+ only) */}
          {hasMinRole(userRole, "GUIDE") && (
            <GuideBadgesSection badges={badges} loading={badgesLoading} />
          )}

          {/* Bento grid */}
          <div className="grid grid-cols-12 gap-4 sm:gap-8 items-start">
            {/* Main feed */}
            <div className="col-span-12 lg:col-span-8 space-y-8">
              <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(25,28,29,0.06)]">
                <div className="relative h-64 overflow-hidden">
                  <div
                    className="w-full h-full bg-cover bg-center"
                    style={{
                      backgroundImage: "url('https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&q=80')",
                      backgroundBlendMode: "color-burn",
                      backgroundColor: "rgba(1,45,29,0.2)",
                    }}
                  />
                  <div className="absolute inset-0 p-4 sm:p-8 flex flex-col justify-end bg-gradient-to-t from-primary/80 to-transparent">
                    <h2 className="text-white text-xl sm:text-3xl font-bold tracking-tight">Zone Alpha Surveillance</h2>
                    <p className="text-emerald-100/80 max-w-md text-sm">Real-time biodiversity monitoring and training track integration for Bako National Park.</p>
                  </div>
                  <div className="absolute top-6 right-6 flex gap-2">
                    <span className="bg-primary/40 backdrop-blur-md text-white text-[0.625rem] px-3 py-1 rounded-full uppercase tracking-tighter border border-white/20">Live GPS Active</span>
                    <span className="bg-[#DC2E27]/40 backdrop-blur-md text-white text-[0.625rem] px-3 py-1 rounded-full uppercase tracking-tighter border border-white/20">AI Detection On</span>
                  </div>
                </div>

                <div className="p-4 sm:p-8">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                    <h3 className="text-lg sm:text-xl font-bold text-primary">Training Alerts &amp; Incidents</h3>
                    {can(userRole, "view:own-guides") && (
                      <button className="text-primary text-sm font-bold flex items-center gap-2 hover:underline">
                        View Full Report <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {FEED_ITEMS.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 sm:gap-6 p-3 sm:p-4 bg-surface-container-low rounded-xl group hover:bg-surface-container-high transition-all">
                        <div className={`h-12 w-12 rounded-full ${item.iconBg} flex items-center justify-center ${item.iconColor} shrink-0`}>
                          <span className="material-symbols-outlined" style={item.fill ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                            {item.icon}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-primary text-sm">{item.title}</h4>
                            <span className="text-[0.625rem] text-on-surface-variant font-medium shrink-0 ml-2">{item.time}</span>
                          </div>
                          <p className="text-sm text-secondary mt-0.5">{item.body}</p>
                        </div>
                        {/* A2.4 — Action buttons only for SENIOR_GUIDE+ */}
                        {can(userRole, "mentor:guides") && (
                          <button className="bg-primary text-white text-xs px-4 py-2 rounded-lg font-bold opacity-0 group-hover:opacity-100 transition-all shrink-0">
                            {item.action}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right sidebar widgets */}
            <div className="col-span-12 lg:col-span-4 space-y-8">
              {/* Active patrols */}
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_20px_40px_rgba(25,28,29,0.06)] space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-primary">Active Patrols</h3>
                  <span className="text-[0.625rem] text-emerald-600 bg-emerald-50 px-2 py-1 rounded font-bold uppercase">12 Teams Out</span>
                </div>
                <div className="aspect-square rounded-xl overflow-hidden relative border border-outline-variant/15 bg-primary-container/20">
                  <div className="absolute inset-0 bg-primary/20" />
                  <div className="absolute top-4 left-4 flex flex-col gap-1">
                    <div className="bg-white/90 backdrop-blur-sm p-1.5 rounded-lg shadow-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#DC2E27] animate-ping" />
                      <span className="text-[0.5rem] font-bold text-primary uppercase">POI 02: Alert</span>
                    </div>
                    <div className="bg-emerald-950/90 backdrop-blur-sm p-1.5 rounded-lg shadow-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-[0.5rem] font-bold text-white uppercase">Team Alpha: Active</span>
                    </div>
                  </div>
                  <div className="absolute bottom-4 right-4 text-[10px] text-emerald-400/80 font-mono tracking-tighter leading-none text-right">
                    LAT: 1.5533° N<br />LON: 110.3592° E<br />ALT: 42M
                  </div>
                </div>

                <div className="space-y-4">
                  {PATROL_MEMBERS.map(({ name, track, progress }) => (
                    <div key={name} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary text-xl">person</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-primary truncate">{name}</p>
                        <p className="text-[10px] text-secondary">{track}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-mono text-emerald-700">Patrolling</p>
                        <div className="h-1 w-12 bg-emerald-200 rounded-full mt-1">
                          <div className="h-1 bg-emerald-500 rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>


            </div>
          </div>
        </section>

        <footer className="w-full py-8 mt-auto bg-emerald-950 flex flex-col md:flex-row justify-between items-center px-4 sm:px-6 lg:px-12 gap-4">
          <div className="text-sm font-bold text-white">Digital Sentinel <span className="font-normal opacity-50 ml-2">Guardian Portal</span></div>
          <div className="flex flex-wrap justify-center gap-6">
            {["Accessibility", "Privacy Policy", "Institutional Links", "Contact Sentinel"].map((l) => (
              <a key={l} href="#" className="text-xs font-light tracking-wide text-emerald-100 opacity-70 hover:opacity-100 hover:text-[#DC2E27] transition-all">{l}</a>
            ))}
          </div>
          <p className="text-xs font-light tracking-wide text-emerald-100 opacity-50">© 2024 Sarawak Forestry Corporation. All rights reserved.</p>
        </footer>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function InterviewScheduler({
  applicationId,
  existing,
  onScheduled,
}: {
  applicationId: string
  existing: { date: string | null; time: string | null; location: string | null }
  onScheduled: () => void | Promise<void>
}) {
  const [open, setOpen]     = useState(!!existing.date)  
  const [date, setDate]     = useState(existing.date ?? "")
  const [time, setTime]     = useState(existing.time?.slice(0, 5) ?? "")
  const [loc,  setLoc]      = useState(existing.location ?? "")
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  async function submit() {
    setErr(null); setSaving(true)
    try {
      const res = await fetch(`/api/applications/${applicationId}/schedule-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time, location: loc }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? "Failed to schedule")
      await onScheduled()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to schedule")
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full text-left px-4 py-2.5 border-2 border-dashed border-indigo-200 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition-all flex items-center gap-2">
        <span className="material-symbols-outlined text-base">event</span>
        Schedule Interview Instead
      </button>
    )
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-900 flex items-center gap-1">
          <span className="material-symbols-outlined text-base">event</span>
          {existing.date ? "Reschedule Interview" : "Schedule Interview"}
        </p>
        <button onClick={() => setOpen(false)} className="text-indigo-700 hover:bg-white/60 rounded p-1">
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Time</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Location</label>
        <input type="text" value={loc} onChange={e => setLoc(e.target.value)}
          placeholder="e.g. SFC HQ Kuching — Meeting Room 3"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      {err && <p className="text-xs text-red-700">{err}</p>}
      <button onClick={submit} disabled={saving || !date || !time || !loc.trim()}
        className="w-full px-4 py-2 rounded-lg bg-indigo-700 text-white font-semibold text-sm hover:bg-indigo-800 transition-all disabled:opacity-50">
        {saving ? "Scheduling…" : existing.date ? "Update Interview" : "Confirm & Notify Applicant"}
      </button>
    </div>
  )
}

// Bug 6: HoD document panel — fetches signed URLs from /api/applications/[id]/documents
function ApplicationDocumentsPanel({ applicationId }: { applicationId: string }) {
  const [docs, setDocs] = useState<Array<{
    id: string
    file_name: string
    file_size: number
    mime_type: string
    uploaded_at: string
    signed_url: string | null
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/applications/${applicationId}/documents`)
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (cancelled) return
        if (!ok) { setError(b.error ?? 'Failed to load documents'); setDocs([]) }
        else { setDocs(b.documents ?? []); setError(null) }
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [applicationId])

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1">
        <span className="material-symbols-outlined text-sm">attach_file</span>
        Uploaded Documents
      </p>
      {loading ? (
        <p className="text-xs text-gray-500">Loading documents…</p>
      ) : error ? (
        <p className="text-xs text-red-600">Error: {error}</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No documents uploaded.</p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map(d => (
            <li key={d.id} className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-sm text-gray-500 shrink-0">description</span>
                <span className="text-sm text-gray-900 truncate">{d.file_name}</span>
                <span className="text-[10px] text-gray-500 shrink-0">
                  {(d.file_size / 1024).toFixed(1)} KB
                </span>
              </div>
              {d.signed_url ? (
                <a
                  href={d.signed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  View
                </a>
              ) : (
                <span className="text-[10px] text-gray-400 shrink-0">No link</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}