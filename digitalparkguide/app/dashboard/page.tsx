"use client";

// A2.4 — Superadmin Dashboard with role-based UI guards
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { can, type AppRole, hasMinRole } from "@/types/roles";
import { ModuleEditorForm, ModuleEditorState } from "@/components/ModuleEditorForm";
import { ModuleHistoryPanel } from "@/components/ModuleHistoryPanel";

// ── Mock feed data (replaced with Supabase queries in later sprints) ──
const FEED_ITEMS = [
  {
    id: 1,
    icon: "report_problem",
    iconBg: "bg-[#DC2E27]/10",
    iconColor: "text-[#DC2E27]",
    title: "Unsanctioned Movement Detected",
    time: "02 MIN AGO",
    body: "Grid 42-B. 3 individuals without active permits. Ranger team dispatching.",
    action: "Assign Guide",
    fill: true,
  },
  {
    id: 2,
    icon: "school",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-800",
    title: "Module Completion: Advanced Tracking",
    time: "14 MIN AGO",
    body: "Ahmad bin Yusuf (Ranger ID: SFC-771) has completed the certification.",
    action: "Verify Bio",
    fill: true,
  },
  {
    id: 3,
    icon: "info",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-800",
    title: "System Update: Biodiversity 2.4",
    time: "1 HOUR AGO",
    body: "New AR overlays added for orchid identification in Guide Track.",
    action: "Release Notes",
    fill: true,
  },
];

const PATROL_MEMBERS = [
  { name: "Sgt. Tan Boon",    track: "Ranger Track Level 4", progress: 66 },
  { name: "Rgr. Siti Aminah", track: "Guide Track Level 2",  progress: 33 },
];

const STATS = [
  { label: "Active Rangers",   value: "1,248", badge: "+12% vs LW",   color: "border-primary",    valueColor: "text-primary",    badgeColor: "text-primary-container" },
  { label: "Training Modules", value: "86%",   badge: "Completion",   color: "border-primary",    valueColor: "text-primary",    badgeColor: "text-primary-container" },
  { label: "Active Incidents", value: "04",    badge: "High Priority", color: "border-[#DC2E27]", valueColor: "text-[#DC2E27]",  badgeColor: "text-[#DC2E27] animate-pulse" },
  { label: "Analytics Score",  value: "9.4",   badge: "System Health", color: "border-secondary", valueColor: "text-secondary",  badgeColor: "text-secondary-container" },
];

const BAR_HEIGHTS = ["h-4", "h-6", "h-8", "h-12", "h-7", "h-10", "h-12"];

interface TrainingTrack {
  id: string
  title: string
  tpa_name: string
  track_type: string
  is_archived: boolean
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
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewer_notes: string;
  submitted_at: string;
  reviewed_at: string | null;
  training_tracks: { title: string } | null;
}

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
  const [trackForm, setTrackForm] = useState({ title: '', tpa_name: '', track_type: 'GUIDE' })
  const [trackSaving, setTrackSaving] = useState(false)
  const [trackToast, setTrackToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Applications state
  const [applications, setApplications] = useState<Application[]>([])
  const [appTab, setAppTab] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING")
  const [expandedApp, setExpandedApp] = useState<string | null>(null)
  const [appNotes, setAppNotes] = useState<Record<string, string>>({})
  const [processingApp, setProcessingApp] = useState<string | null>(null)
  const [appToast, setAppToast] = useState<{ msg: string; ok: boolean } | null>(null)

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

      // Load training modules for GUIDE+ (read-only for guides, CRUD for HOD+)
      if (hasMinRole(profile?.role as AppRole, "GUIDE")) {
        await loadTrainingModulesData()
      }
      // Load applications and module history for HOD+
      if (hasMinRole(profile?.role as AppRole, "HOD")) {
        await loadApplicationsData()
        await loadModuleHistory()
      }

      setLoading(false);
    }

    init();
  }, []);

  const loadTrainingModulesData = async () => {
    try {
      // Fetch training tracks
      const { data: tracks, error: tracksError } = await supabase
        .from('training_tracks')
        .select('id, title, tpa_name, track_type, is_archived')
        .order('tpa_name')

      if (tracksError) throw tracksError
      setTrainingTracks((tracks || []) as unknown as TrainingTrack[])

      // Fetch modules
      const { data: mods, error: modsError } = await supabase
        .from('training_modules')
        .select('id, track_id, title, is_active, is_archived, additional_track_ids, created_at, training_tracks(id, title, tpa_name, track_type)')
        .order('order_index')

      if (modsError) throw modsError
      setModules((mods || []) as unknown as Module[])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load training modules data'
      setError(message)
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

  function openCreateTrack() {
    setEditingTrack(null)
    setTrackForm({ title: '', tpa_name: '', track_type: 'GUIDE' })
    setTrackModalOpen(true)
  }

  function openEditTrack(track: TrainingTrack) {
    setEditingTrack(track)
    setTrackForm({ title: track.title, tpa_name: track.tpa_name, track_type: track.track_type })
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
      if (editingTrack) {
        const { error } = await supabase
          .from('training_tracks')
          .update({ title: trackForm.title.trim(), tpa_name: trackForm.tpa_name.trim(), track_type: trackForm.track_type })
          .eq('id', editingTrack.id)
        if (error) throw error
        setTrainingTracks(prev => prev.map(t => t.id === editingTrack.id ? { ...t, ...trackForm } : t))
        setTrackToast({ msg: 'Park Badge updated.', ok: true })
      } else {
        const { data: newTrack, error } = await supabase
          .from('training_tracks')
          .insert({ title: trackForm.title.trim(), tpa_name: trackForm.tpa_name.trim(), track_type: trackForm.track_type })
          .select('id, title, tpa_name, track_type, is_archived')
          .single()
        if (error) throw error
        setTrainingTracks(prev => [...prev, newTrack as unknown as TrainingTrack])
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

    // Cascade: handle all modules where this is the primary track
    const primaryMods = modules.filter(m => m.track_id === id && !m.is_archived)
    for (const mod of primaryMods) {
      const extra = (mod.additional_track_ids || []).filter(tid => tid !== id)
      if (extra.length === 0) {
        await supabase.from('training_modules').update({ is_archived: true }).eq('id', mod.id)
      } else {
        await supabase.from('training_modules').update({ track_id: extra[0], additional_track_ids: extra.slice(1) }).eq('id', mod.id)
      }
    }
    // Remove from additional_track_ids on other modules
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
    // Cascade: restore modules that were archived solely because of this track
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
    const { error } = await supabase.rpc("approve_guide_application", {
      p_app_id: appId,
      p_notes: appNotes[appId] ?? "",
    });
    setProcessingApp(null);
    if (error) { showAppToast(error.message, false); return; }
    showAppToast("Application approved. Role upgraded to Guide.", true);
    setExpandedApp(null);
    await loadApplicationsData();
  }

  const handleRejectApplication = async (appId: string) => {
    if (!appNotes[appId]?.trim()) { showAppToast("Rejection notes are required.", false); return; }
    setProcessingApp(appId);
    const { error } = await supabase.rpc("reject_guide_application", {
      p_app_id: appId,
      p_notes: appNotes[appId].trim(),
    });
    setProcessingApp(null);
    if (error) { showAppToast(error.message, false); return; }
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
    const editContent = (
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

    return editContent
  }

  // Training Modules Create View
  if (hasMinRole(userRole, 'HOD') && action === 'new') {
    const createContent = (
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

    return createContent
  }

  // Training Modules List View
  if (hasMinRole(userRole, 'GUIDE') && !hasMinRole(userRole, 'HOD') && action === 'modules') {
    router.replace('/training/modules')
    return null
  }

  // Tracks view — redirect non-HOD guides to their dedicated tracks page
  if (hasMinRole(userRole, 'GUIDE') && !hasMinRole(userRole, 'HOD') && action === 'tracks') {
    router.replace('/training/tracks')
    return null
  }

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

    const modulesContent = (
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
            <select
              value={selectedTpa}
              onChange={(e) => setSelectedTpa(e.target.value)}
              className="px-4 py-2 rounded-lg border border-[#cbd5e1] bg-white text-[#1B3A24]"
            >
              <option value="">All Park Badges</option>
              {uniqueTpas.map((tpa) => (
                <option key={tpa} value={tpa}>{tpa}</option>
              ))}
            </select>
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
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Module Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Park Badge / TPA</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Created</th>
                    {isHodView && <th className="px-6 py-3 text-right text-xs font-semibold text-[#1B3A24]">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredModules.map((module, idx) => {
                    const additionalTracks = (module.additional_track_ids || []).map(tid => trainingTracks.find(t => t.id === tid)).filter(Boolean)
                    return (
                      <tr key={module.id} className={`border-b border-[#e2e8f0] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
                        <td className="px-6 py-4"><p className="font-medium text-[#1B3A24]">{module.title}</p></td>
                        <td className="px-6 py-4 text-sm text-[#475569]">
                          <p className="font-medium">{module.training_tracks?.title || 'Unknown'}</p>
                          <p className="text-xs text-[#64748b]">{module.training_tracks?.tpa_name || 'Unknown'}</p>
                          {additionalTracks.map(t => t && (
                            <p key={t.id} className="text-xs text-blue-600 mt-0.5">+ {t.tpa_name}</p>
                          ))}
                        </td>
                        <td className="px-6 py-4">
                          <span className={module.is_active ? 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800' : 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800'}>
                            {module.is_active ? '✓ Published' : '⊝ Draft'}
                          </span>
                        </td>
                        <td className="px-6 py-4"><p className="text-sm text-[#64748b]">{new Date(module.created_at).toLocaleDateString()}</p></td>
                        {isHodView && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => router.push(`/dashboard?action=edit&id=${module.id}`)} className="px-3 py-1 text-sm font-medium text-[#2D6A3F] hover:bg-[#f0f4f8] rounded transition-colors">✎ Edit</button>
                              <button onClick={() => handleArchiveModule(module.id)} className="px-3 py-1 text-sm font-medium text-amber-600 hover:bg-amber-50 rounded transition-colors">📦 Archive</button>
                              <button onClick={() => handleDeleteModule(module.id)} className="px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 rounded transition-colors">🗑️ Delete</button>
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

          {/* Archived modules panel */}
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
                            <button onClick={() => handleRestoreModule(module.id)} className="px-3 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded transition-colors flex items-center gap-1 ml-auto">
                              <span className="material-symbols-outlined text-sm">restore</span>Restore
                            </button>
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

    return modulesContent
  }

  // Park Badges (Training Tracks) CRUD View
  if (hasMinRole(userRole, 'HOD') && action === 'tracks') {
    const tracksContent = (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-6xl mx-auto">
          {/* Toast */}
          {trackToast && (
            <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white ${trackToast.ok ? 'bg-emerald-700' : 'bg-red-700'}`}>
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{trackToast.ok ? 'check_circle' : 'error'}</span>
              {trackToast.msg}
            </div>
          )}

          {/* Modal */}
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
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#012d1d]/20 focus:border-[#012d1d] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">Totally Protected Area (TPA)</label>
                    <input
                      type="text"
                      value={trackForm.tpa_name}
                      onChange={e => setTrackForm(f => ({ ...f, tpa_name: e.target.value }))}
                      placeholder="e.g. Bako National Park"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#012d1d]/20 focus:border-[#012d1d] transition-all"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Guides certified under this badge can only operate in this TPA.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">Badge Type</label>
                    <div className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-[#f8fafc] text-gray-500">Guide Track</div>
                  </div>
                </div>
                <div className="flex gap-3 justify-end mt-8">
                  <button onClick={() => setTrackModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">Cancel</button>
                  <button onClick={handleSaveTrack} disabled={trackSaving}
                    className="px-6 py-2.5 rounded-xl bg-[#012d1d] text-white text-sm font-semibold hover:bg-[#024a2f] transition-all disabled:opacity-50 flex items-center gap-2">
                    {trackSaving && <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>}
                    {editingTrack ? 'Save Changes' : 'Create Badge'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
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

          {/* Active badges table */}
          {trainingTracks.filter(t => !t.is_archived).length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center shadow-sm">
              <div className="text-4xl mb-3">🏅</div>
              <h3 className="text-lg font-semibold text-[#1B3A24] mb-1">No active Park Badges</h3>
              <p className="text-[#64748b] mb-6">Create your first badge to start certifying guides for a specific park.</p>
              <button onClick={openCreateTrack} className="px-6 py-2.5 bg-[#2D6A3F] text-white font-medium rounded-lg hover:bg-[#1B3A24]">Create Badge</button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Badge Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">TPA (Park)</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Type</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-[#1B3A24]">Actions</th>
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
                      <td className="px-6 py-4"><span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800">🧭 Guide</span></td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEditTrack(track)} className="px-3 py-1 text-sm font-medium text-[#2D6A3F] hover:bg-[#f0f4f8] rounded transition-colors">✎ Edit</button>
                          <button onClick={() => handleArchiveTrack(track.id)} className="px-3 py-1 text-sm font-medium text-amber-600 hover:bg-amber-50 rounded transition-colors">📦 Archive</button>
                          <button onClick={() => handleDeleteTrack(track.id)} className="px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 rounded transition-colors">🗑️ Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Archived badges panel */}
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
                            <button onClick={() => handleUnarchiveTrack(track.id)} className="px-3 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded transition-colors flex items-center gap-1 ml-auto">
                              <span className="material-symbols-outlined text-sm">restore</span>Restore
                            </button>
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

    return tracksContent
  }

  // Module History View (B1.5)
  if (hasMinRole(userRole, 'HOD') && action === 'module-history') {
    const CHANGE_BADGE: Record<string, { label: string; color: string }> = {
      create:   { label: 'Created',  color: 'bg-emerald-100 text-emerald-800' },
      update:   { label: 'Updated',  color: 'bg-blue-100 text-blue-800' },
      rollback: { label: 'Rollback', color: 'bg-amber-100 text-amber-800' },
    }

    const historyContent = (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#1B3A24] mb-1">Module Edit History</h1>
            <p className="text-[#64748b]">Audit log of all training module changes — editor identity, timestamps, and version rollbacks.</p>
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
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Module</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Park Badge / TPA</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Change</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Editor</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Ver.</th>
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

    return historyContent
  }

  // Applications View
  if (hasMinRole(userRole, 'HOD') && action === 'applications') {
    const filteredApps = applications.filter(a => a.status === appTab);
    const appCounts = {
      PENDING: applications.filter(a => a.status === "PENDING").length,
      APPROVED: applications.filter(a => a.status === "APPROVED").length,
      REJECTED: applications.filter(a => a.status === "REJECTED").length,
    };

    const TAB_CONFIG = {
      PENDING:  { label: "Pending",  icon: "hourglass_top", color: "text-amber-700",  badge: "bg-amber-100 text-amber-800" },
      APPROVED: { label: "Approved", icon: "verified",      color: "text-emerald-700",badge: "bg-emerald-100 text-emerald-800" },
      REJECTED: { label: "Rejected", icon: "cancel",        color: "text-red-700",    badge: "bg-red-50 text-red-800" },
    };

    const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });

    const applicationsContent = (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#1B3A24] mb-2">Guide Applications</h1>
            <p className="text-[#64748b]">Review, approve, or reject certification applications.</p>
          </div>

          {/* Toast */}
          {appToast && (
            <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white ${appToast.ok ? "bg-emerald-700" : "bg-red-700"}`}>
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{appToast.ok ? "check_circle" : "error"}</span>
              {appToast.msg}
            </div>
          )}

          <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
            <div className="flex gap-3">
              {(["PENDING","APPROVED","REJECTED"] as const).map(s => (
                <div key={s} className={`text-center px-4 py-2 rounded-xl border ${s === "PENDING" ? "bg-amber-50 border-amber-200" : s === "APPROVED" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                  <p className={`text-xl font-black ${s === "PENDING" ? "text-amber-700" : s === "APPROVED" ? "text-emerald-700" : "text-red-700"}`}>{appCounts[s]}</p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">{s}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
            {(["PENDING","APPROVED","REJECTED"] as const).map(t => {
              const cfg = TAB_CONFIG[t];
              return (
                <button key={t} onClick={() => setAppTab(t)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${appTab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                  <span className={`material-symbols-outlined text-base ${appTab === t ? cfg.color : ""}`} style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
                  {cfg.label}
                  {appCounts[t] > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${cfg.badge}`}>{appCounts[t]}</span>}
                </button>
              );
            })}
          </div>

          {/* Applications list */}
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
                      <div className="w-10 h-10 bg-[#012d1d] rounded-full flex items-center justify-center text-white font-black text-sm shrink-0">
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
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#012d1d] transition-colors shrink-0 px-3 py-2 rounded-lg hover:bg-gray-50">
                        {isOpen ? "Collapse" : "Review"}
                        <span className="material-symbols-outlined text-base">{isOpen ? "expand_less" : "expand_more"}</span>
                      </button>
                    </div>

                    {isOpen && (
                      <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-xs">
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

                        {app.status !== "PENDING" && app.reviewer_notes && (
                          <div className={`rounded-xl p-4 ${app.status === "APPROVED" ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Your Notes</p>
                            <p className="text-sm text-gray-800 leading-relaxed">{app.reviewer_notes}</p>
                            <p className="text-[10px] text-gray-400 mt-2">Reviewed on {app.reviewed_at ? formatDate(app.reviewed_at) : "—"}</p>
                          </div>
                        )}

                        {app.status === "PENDING" && (
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
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-[#012d1d]/20 focus:border-[#012d1d] transition-all"
                              />
                            </div>

                            <div className="flex gap-3 justify-end">
                              <button onClick={() => handleRejectApplication(app.id)} disabled={processingApp === app.id}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-red-200 text-red-700 font-semibold text-sm hover:bg-red-50 transition-all disabled:opacity-50">
                                {processingApp === app.id ? <span className="material-symbols-outlined animate-spin text-base">progress_activity</span> : <span className="material-symbols-outlined text-base">cancel</span>}
                                Reject
                              </button>
                              <button onClick={() => handleApproveApplication(app.id)} disabled={processingApp === app.id}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#012d1d] text-white font-semibold text-sm hover:bg-[#024a2f] transition-all disabled:opacity-50">
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

    return applicationsContent
  }

  return (
    <>

        <section className="p-8 space-y-8">
          {/* Stats grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {STATS.map(({ label, value, badge, color, valueColor, badgeColor }) => (
              <div key={label} className={`bg-surface-container-low p-6 rounded-xl space-y-2 border-l-4 ${color}`}>
                <p className="text-on-surface-variant uppercase text-[0.6875rem] font-bold tracking-widest">{label}</p>
                <div className="flex items-end justify-between">
                  <span className={`text-3xl font-black ${valueColor}`}>{value}</span>
                  <span className={`text-xs font-bold ${badgeColor}`}>{badge}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bento grid */}
          <div className="grid grid-cols-12 gap-8 items-start">
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
                  <div className="absolute inset-0 p-8 flex flex-col justify-end bg-gradient-to-t from-primary/80 to-transparent">
                    <h2 className="text-white text-3xl font-bold tracking-tight">Zone Alpha Surveillance</h2>
                    <p className="text-emerald-100/80 max-w-md text-sm">Real-time biodiversity monitoring and training track integration for Bako National Park.</p>
                  </div>
                  <div className="absolute top-6 right-6 flex gap-2">
                    <span className="bg-primary/40 backdrop-blur-md text-white text-[0.625rem] px-3 py-1 rounded-full uppercase tracking-tighter border border-white/20">Live GPS Active</span>
                    <span className="bg-[#DC2E27]/40 backdrop-blur-md text-white text-[0.625rem] px-3 py-1 rounded-full uppercase tracking-tighter border border-white/20">AI Detection On</span>
                  </div>
                </div>

                <div className="p-8">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-primary">Training Alerts &amp; Incidents</h3>
                    {can(userRole, "view:own-guides") && (
                      <button className="text-primary text-sm font-bold flex items-center gap-2 hover:underline">
                        View Full Report <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {FEED_ITEMS.map((item) => (
                      <div key={item.id} className="flex items-center gap-6 p-4 bg-surface-container-low rounded-xl group hover:bg-surface-container-high transition-all">
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

        <footer className="w-full py-8 mt-auto bg-emerald-950 flex flex-col md:flex-row justify-between items-center px-12 gap-4">
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
