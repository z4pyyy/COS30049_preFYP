"use client";

// A2.4 — Superadmin Dashboard with role-based UI guards
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { can, type AppRole, hasMinRole } from "@/types/roles";
import type { User } from "@supabase/supabase-js";
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
}

interface Module {
  id: string
  track_id: string
  title: string
  is_active: boolean
  created_at: string
  training_tracks?: Array<{
    id: string
    title: string
    tpa_name: string
    track_type: string
  }>
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

  const [user,    setUser]    = useState<User | null>(null);
  const [userRole, setUserRole] = useState<AppRole>("GUIDE");
  const [userName, setUserName] = useState<string>("Guardian");
  const [loading, setLoading] = useState(true);

  // Training modules state
  const [modules, setModules] = useState<Module[]>([])
  const [trainingTracks, setTrainingTracks] = useState<TrainingTrack[]>([])
  const [selectedTpa, setSelectedTpa] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

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

      setUser(user);
      setUserName(user.user_metadata?.full_name ?? user.email ?? "Guardian");

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

      // Load training modules and applications data for HOD users
      if (profile?.role === "HOD" || hasMinRole(profile?.role as AppRole, "HOD")) {
        await loadTrainingModulesData()
        await loadApplicationsData()
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
        .select('id, title, tpa_name, track_type')
        .order('tpa_name')

      if (tracksError) throw tracksError
      setTrainingTracks(tracks || [])

      // Fetch modules
      const { data: mods, error: modsError } = await supabase
        .from('training_modules')
        .select('id, track_id, title, is_active, created_at, training_tracks(id, title, tpa_name, track_type)')
        .order('order_index')

      if (modsError) throw modsError
      setModules(mods || [])
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

  const handleCreateModule = async (data: ModuleEditorState) => {
    try {
      setIsSaving(true)
      setError(null)

      const { data: newModule, error } = await supabase
        .from('training_modules')
        .insert({
          track_id: data.track_id,
          title: data.title,
          description: data.description,
          content: data.content,
          order_index: data.order_index,
          duration_hours: data.duration_hours,
          is_active: data.is_active,
        })
        .select('id, track_id, title, is_active, created_at, training_tracks(id, title, tpa_name, track_type)')
        .single()

      if (error) throw error

      setModules((prev) => [ ...prev, { id: newModule.id, track_id: newModule.track_id, title: newModule.title, is_active: newModule.is_active, created_at: newModule.created_at }])
      router.push(`/dashboard?action=edit&id=${newModule.id}`)
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
          title: data.title,
          description: data.description,
          content: data.content,
          order_index: data.order_index,
          duration_hours: data.duration_hours,
          is_active: data.is_active,
        })
        .eq('id', moduleId)
        .select('id, track_id, title, is_active, created_at, training_tracks(id, title, tpa_name, track_type)')
        .single()

      if (error) throw error

      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId
            ? {
                ...m,
                title: updatedModule?.title || m.title,
                is_active: updatedModule?.is_active ?? m.is_active,
                training_tracks: updatedModule?.training_tracks ?? m.training_tracks,
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

  const handleDeleteModule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this module? This action cannot be undone.')) {
      return
    }

    try {
      setError(null)

      const { error } = await supabase
        .from('training_modules')
        .delete()
        .eq('id', id)

      if (error) throw error

      setModules((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete module'
      setError(message)
    }
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
              trainingTracks={trainingTracks}
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

    return (
      <div className="bg-surface text-on-surface flex min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* ── Sidebar ── */}
        <aside className="h-screen w-64 fixed left-0 top-0 z-40 bg-slate-50 flex flex-col p-4">
          <div className="mb-10 px-4">
            <h1 className="font-black text-emerald-900 text-xl tracking-tighter">Guardian Portal</h1>
            <p className="text-[0.6875rem] uppercase tracking-widest text-slate-500 font-medium">Biodiversity Unit</p>
          </div>

          <nav className="flex-1 space-y-2">
            {[
              { href: "/dashboard",          icon: "dashboard",   label: "Overview",     active: false },
              { href: "/dashboard/training",  icon: "forest",      label: "Ranger Track", active: false },
              { href: "/dashboard/guides",    icon: "explore",     label: "Guide Track",  active: false },
              { href: "/dashboard/tracks", icon: "trophy",      label: "Tracks",       active: false },
              // Training Modules for HOD+
              ...(hasMinRole(userRole, "HOD") ? [{ href: "/dashboard?action=modules", icon: "school", label: "Training Modules", active: true }] : []),
              // A2.4 — Analytics only for HOD+
              ...(hasMinRole(userRole, "HOD") ? [{ href: "/dashboard?action=applications", icon: "person_add", label: "Applications", active: false }] : []),
            ].map(({ href, icon, label, active }) => (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 text-sm font-medium uppercase tracking-widest ${
                  active ? "bg-emerald-100 text-emerald-900 translate-x-1" : "text-slate-500 hover:bg-slate-200"
                }`}
              >
                <span className="material-symbols-outlined">{icon}</span>
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto space-y-2 pt-6">
            <button className="w-full bg-[#DC2E27] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all text-sm">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
              Live Incident
            </button>
            <div className="pt-4 space-y-1">
              <a href="#" className="flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all text-[0.6875rem] uppercase tracking-widest font-medium">
                <span className="material-symbols-outlined text-sm">help</span> Support
              </a>
              <button onClick={handleSignOut} className="w-full flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all text-[0.6875rem] uppercase tracking-widest font-medium">
                <span className="material-symbols-outlined text-sm">logout</span> Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="ml-64 flex-1 flex flex-col min-h-screen">
          {/* Top bar */}
          <header className="bg-emerald-950/90 backdrop-blur-xl sticky top-0 z-50 flex justify-between items-center w-full px-12 py-4 shadow-[0_20px_40px_rgba(25,28,29,0.06)]">
            <div className="flex items-center gap-12">
              <span className="text-xl font-bold tracking-tighter text-white">Digital Sentinel</span>
              <nav className="hidden md:flex gap-8 items-center text-sm">
                <Link href="/training"      className="text-emerald-100/70 hover:text-white transition-colors tracking-tight">Training</Link>
                <Link href="/announcements" className="text-emerald-100/70 hover:text-white transition-colors tracking-tight">Programmes</Link>
                <span className="text-white border-b-2 border-[#DC2E27] pb-1 tracking-tight cursor-default">Dashboard</span>
              </nav>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative">
                <span className="material-symbols-outlined text-white hover:bg-white/10 p-2 rounded-full cursor-pointer transition-all">notifications</span>
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#DC2E27] rounded-full" />
              </div>
              {/* A2.4 — Settings only for HOD+ */}
              {can(userRole, "manage:department") && (
                <span className="material-symbols-outlined text-white hover:bg-white/10 p-2 rounded-full cursor-pointer transition-all">settings</span>
              )}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full border-2 border-emerald-500/30 bg-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-xl">person</span>
                </div>
                <div className="hidden md:block">
                  <p className="text-white text-xs font-bold truncate max-w-[120px]">{userName}</p>
                  <p className="text-emerald-100/50 text-[10px] uppercase tracking-wider">{userRole.replace("_", " ")}</p>
                </div>
              </div>
            </div>
          </header>

          {editContent}
        </main>
      </div>
    )
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
              trainingTracks={trainingTracks}
            />
          </div>
        </div>
      </div>
    )

    return (
      <div className="bg-surface text-on-surface flex min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* ── Sidebar ── */}
        <aside className="h-screen w-64 fixed left-0 top-0 z-40 bg-slate-50 flex flex-col p-4">
          <div className="mb-10 px-4">
            <h1 className="font-black text-emerald-900 text-xl tracking-tighter">Guardian Portal</h1>
            <p className="text-[0.6875rem] uppercase tracking-widest text-slate-500 font-medium">Biodiversity Unit</p>
          </div>

          <nav className="flex-1 space-y-2">
            {[
              { href: "/dashboard",          icon: "dashboard",   label: "Overview",     active: false },
              { href: "/dashboard/training",  icon: "forest",      label: "Ranger Track", active: false },
              { href: "/dashboard/guides",    icon: "explore",     label: "Guide Track",  active: false },
              { href: "/dashboard/tracks", icon: "trophy",      label: "Tracks",       active: false },
              // Training Modules for HOD+
              ...(hasMinRole(userRole, "HOD") ? [{ href: "/dashboard?action=modules", icon: "school", label: "Training Modules", active: true }] : []),
              // A2.4 — Analytics only for HOD+
              ...(hasMinRole(userRole, "HOD") ? [{ href: "/dashboard?action=applications", icon: "person_add", label: "Applications", active: false }] : []),
            ].map(({ href, icon, label, active }) => (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 text-sm font-medium uppercase tracking-widest ${
                  active ? "bg-emerald-100 text-emerald-900 translate-x-1" : "text-slate-500 hover:bg-slate-200"
                }`}
              >
                <span className="material-symbols-outlined">{icon}</span>
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto space-y-2 pt-6">
            <button className="w-full bg-[#DC2E27] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all text-sm">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
              Live Incident
            </button>
            <div className="pt-4 space-y-1">
              <a href="#" className="flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all text-[0.6875rem] uppercase tracking-widest font-medium">
                <span className="material-symbols-outlined text-sm">help</span> Support
              </a>
              <button onClick={handleSignOut} className="w-full flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all text-[0.6875rem] uppercase tracking-widest font-medium">
                <span className="material-symbols-outlined text-sm">logout</span> Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="ml-64 flex-1 flex flex-col min-h-screen">
          {/* Top bar */}
          <header className="bg-emerald-950/90 backdrop-blur-xl sticky top-0 z-50 flex justify-between items-center w-full px-12 py-4 shadow-[0_20px_40px_rgba(25,28,29,0.06)]">
            <div className="flex items-center gap-12">
              <span className="text-xl font-bold tracking-tighter text-white">Digital Sentinel</span>
              <nav className="hidden md:flex gap-8 items-center text-sm">
                <Link href="/training"      className="text-emerald-100/70 hover:text-white transition-colors tracking-tight">Training</Link>
                <Link href="/announcements" className="text-emerald-100/70 hover:text-white transition-colors tracking-tight">Programmes</Link>
                <span className="text-white border-b-2 border-[#DC2E27] pb-1 tracking-tight cursor-default">Dashboard</span>
              </nav>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative">
                <span className="material-symbols-outlined text-white hover:bg-white/10 p-2 rounded-full cursor-pointer transition-all">notifications</span>
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#DC2E27] rounded-full" />
              </div>
              {/* A2.4 — Settings only for HOD+ */}
              {can(userRole, "manage:department") && (
                <span className="material-symbols-outlined text-white hover:bg-white/10 p-2 rounded-full cursor-pointer transition-all">settings</span>
              )}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full border-2 border-emerald-500/30 bg-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-xl">person</span>
                </div>
                <div className="hidden md:block">
                  <p className="text-white text-xs font-bold truncate max-w-[120px]">{userName}</p>
                  <p className="text-emerald-100/50 text-[10px] uppercase tracking-wider">{userRole.replace("_", " ")}</p>
                </div>
              </div>
            </div>
          </header>

          {createContent}
        </main>
      </div>
    )
  }

  // Training Modules List View
  if (hasMinRole(userRole, 'HOD') && action === 'modules') {
    const filteredModules = selectedTpa
      ? modules.filter((m) => m.training_tracks?.[0]?.tpa_name === selectedTpa)
      : modules

    const uniqueTpas = Array.from(new Set(trainingTracks.map((t) => t.tpa_name)))

    const modulesContent = (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#1B3A24] mb-2">Training Modules</h1>
            <p className="text-[#64748b]">
              Manage training modules for all certification tracks
            </p>
          </div>
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-[#1B3A24]">Filter by TPA</label>
              <select
                value={selectedTpa}
                onChange={(e) => setSelectedTpa(e.target.value)}
                className="px-4 py-2 rounded-lg border border-[#cbd5e1] bg-white text-[#1B3A24]"
              >
                <option value="">All TPAs</option>
                {uniqueTpas.map((tpa) => (
                  <option key={tpa} value={tpa}>
                    {tpa}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => router.push('/dashboard?action=new')}
              className="px-6 py-2.5 bg-[#2D6A3F] text-white font-medium rounded-lg hover:bg-[#1B3A24] transition-colors flex items-center gap-2"
            >
              ✨ Create New Module
            </button>
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
              <p className="text-[#64748b] mb-6">Create your first training module to get started</p>
              <button
                onClick={() => router.push('/dashboard?action=new')}
                className="px-6 py-2.5 bg-[#2D6A3F] text-white font-medium rounded-lg hover:bg-[#1B3A24]"
              >
                Create Module
              </button>
            </div>
          ) : filteredModules.length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center shadow-sm">
              <div className="text-4xl mb-3">🔎</div>
              <h3 className="text-lg font-semibold text-[#1B3A24] mb-1">No modules found</h3>
              <p className="text-[#64748b]">
                No modules matching the selected TPA. Clear the filter or select another TPA.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Module Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Track / TPA</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#1B3A24]">Created</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-[#1B3A24]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModules.map((module, idx) => (
                    <tr key={module.id} className={`border-b border-[#e2e8f0] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
                      <td className="px-6 py-4"><p className="font-medium text-[#1B3A24]">{module.title}</p></td>
                      <td className="px-6 py-4 text-sm text-[#475569]">
                        <p className="font-medium">{module.training_tracks?.[0]?.title || 'Unknown'}</p>
                        <p className="text-xs text-[#64748b]">{module.training_tracks?.[0]?.tpa_name || 'Unknown'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={module.is_active ? 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800' : 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800'}>
                          {module.is_active ? '✓ Published' : '⊝ Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4"><p className="text-sm text-[#64748b]">{new Date(module.created_at).toLocaleDateString()}</p></td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => router.push(`/dashboard?action=edit&id=${module.id}`)} className="px-3 py-1 text-sm font-medium text-[#2D6A3F] hover:bg-[#f0f4f8] rounded transition-colors">✎ Edit</button>
                          <button onClick={() => handleDeleteModule(module.id)} className="px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 rounded transition-colors">🗑️ Delete</button>
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

    return (
      <div className="bg-surface text-on-surface flex min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* ── Sidebar ── */}
        <aside className="h-screen w-64 fixed left-0 top-0 z-40 bg-slate-50 flex flex-col p-4">
          <div className="mb-10 px-4">
            <h1 className="font-black text-emerald-900 text-xl tracking-tighter">Guardian Portal</h1>
            <p className="text-[0.6875rem] uppercase tracking-widest text-slate-500 font-medium">Biodiversity Unit</p>
          </div>

          <nav className="flex-1 space-y-2">
            {[
              { href: "/dashboard",          icon: "dashboard",   label: "Overview",     active: false },
              { href: "/dashboard/training",  icon: "forest",      label: "Ranger Track", active: false },
              { href: "/dashboard/guides",    icon: "explore",     label: "Guide Track",  active: false },
              { href: "/dashboard/tracks", icon: "trophy",      label: "Tracks",       active: false },
              // Training Modules for HOD+
              ...(hasMinRole(userRole, "HOD") ? [{ href: "/dashboard?action=modules", icon: "school", label: "Training Modules", active: true }] : []),
              // A2.4 — Analytics only for HOD+
              ...(hasMinRole(userRole, "HOD") ? [{ href: "/dashboard?action=applications", icon: "person_add", label: "Applications", active: false }] : []),
            ].map(({ href, icon, label, active }) => (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 text-sm font-medium uppercase tracking-widest ${
                  active ? "bg-emerald-100 text-emerald-900 translate-x-1" : "text-slate-500 hover:bg-slate-200"
                }`}
              >
                <span className="material-symbols-outlined">{icon}</span>
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto space-y-2 pt-6">
            <button className="w-full bg-[#DC2E27] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all text-sm">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
              Live Incident
            </button>
            <div className="pt-4 space-y-1">
              <a href="#" className="flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all text-[0.6875rem] uppercase tracking-widest font-medium">
                <span className="material-symbols-outlined text-sm">help</span> Support
              </a>
              <button onClick={handleSignOut} className="w-full flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all text-[0.6875rem] uppercase tracking-widest font-medium">
                <span className="material-symbols-outlined text-sm">logout</span> Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="ml-64 flex-1 flex flex-col min-h-screen">
          {/* Top bar */}
          <header className="bg-emerald-950/90 backdrop-blur-xl sticky top-0 z-50 flex justify-between items-center w-full px-12 py-4 shadow-[0_20px_40px_rgba(25,28,29,0.06)]">
            <div className="flex items-center gap-12">
              <span className="text-xl font-bold tracking-tighter text-white">Digital Sentinel</span>
              <nav className="hidden md:flex gap-8 items-center text-sm">
                <Link href="/training"      className="text-emerald-100/70 hover:text-white transition-colors tracking-tight">Training</Link>
                <Link href="/announcements" className="text-emerald-100/70 hover:text-white transition-colors tracking-tight">Programmes</Link>
                <span className="text-white border-b-2 border-[#DC2E27] pb-1 tracking-tight cursor-default">Dashboard</span>
              </nav>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative">
                <span className="material-symbols-outlined text-white hover:bg-white/10 p-2 rounded-full cursor-pointer transition-all">notifications</span>
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#DC2E27] rounded-full" />
              </div>
              {/* A2.4 — Settings only for HOD+ */}
              {can(userRole, "manage:department") && (
                <span className="material-symbols-outlined text-white hover:bg-white/10 p-2 rounded-full cursor-pointer transition-all">settings</span>
              )}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full border-2 border-emerald-500/30 bg-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-xl">person</span>
                </div>
                <div className="hidden md:block">
                  <p className="text-white text-xs font-bold truncate max-w-[120px]">{userName}</p>
                  <p className="text-emerald-100/50 text-[10px] uppercase tracking-wider">{userRole.replace("_", " ")}</p>
                </div>
              </div>
            </div>
          </header>

          {modulesContent}
        </main>
      </div>
    )
  }

  // Training Tracks View
  if (hasMinRole(userRole, 'HOD') && action === 'tracks') {
    const tracksContent = (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#1B3A24] mb-2">Training Tracks</h1>
            <p className="text-[#64748b]">
              Manage certification tracks for all Totally Protected Areas
            </p>
          </div>

          {trainingTracks.length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center shadow-sm">
              <div className="text-4xl mb-3">🏆</div>
              <p className="text-[#64748b]">No training tracks found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {trainingTracks.map((track) => (
                <div
                  key={track.id}
                  className="bg-white rounded-lg p-6 shadow-sm border border-[#e2e8f0]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-[#1B3A24] text-lg">{track.title}</h3>
                      <p className="text-sm text-[#64748b]">{track.tpa_name}</p>
                    </div>
                  </div>
                  <div className="text-xs text-[#64748b]">
                    <p>Type: {track.track_type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )

    return (
      <div className="bg-surface text-on-surface flex min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* ── Sidebar ── */}
        <aside className="h-screen w-64 fixed left-0 top-0 z-40 bg-slate-50 flex flex-col p-4">
          <div className="mb-10 px-4">
            <h1 className="font-black text-emerald-900 text-xl tracking-tighter">Guardian Portal</h1>
            <p className="text-[0.6875rem] uppercase tracking-widest text-slate-500 font-medium">Biodiversity Unit</p>
          </div>

          <nav className="flex-1 space-y-2">
            {[
              { href: "/dashboard",          icon: "dashboard",   label: "Overview",     active: false },
              { href: "/dashboard/training",  icon: "forest",      label: "Ranger Track", active: false },
              { href: "/dashboard/guides",    icon: "explore",     label: "Guide Track",  active: false },
              { href: "/dashboard/tracks", icon: "trophy",      label: "Tracks",       active: true },
              // Training Modules for HOD+
              ...(hasMinRole(userRole, "HOD") ? [{ href: "/dashboard?action=modules", icon: "school", label: "Training Modules", active: false }] : []),
              // A2.4 — Applications only for HOD+
              ...(hasMinRole(userRole, "HOD") ? [{ href: "/dashboard?action=applications", icon: "person_add", label: "Applications", active: false }] : []),
            ].map(({ href, icon, label, active }) => (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 text-sm font-medium uppercase tracking-widest ${
                  active ? "bg-emerald-100 text-emerald-900 translate-x-1" : "text-slate-500 hover:bg-slate-200"
                }`}
              >
                <span className="material-symbols-outlined">{icon}</span>
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto space-y-2 pt-6">
            <button className="w-full bg-[#DC2E27] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all text-sm">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
              Live Incident
            </button>
            <div className="pt-4 space-y-1">
              <a href="#" className="flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all text-[0.6875rem] uppercase tracking-widest font-medium">
                <span className="material-symbols-outlined text-sm">help</span> Support
              </a>
              <button onClick={handleSignOut} className="w-full flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all text-[0.6875rem] uppercase tracking-widest font-medium">
                <span className="material-symbols-outlined text-sm">logout</span> Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="ml-64 flex-1 flex flex-col min-h-screen">
          {/* Top bar */}
          <header className="bg-emerald-950/90 backdrop-blur-xl sticky top-0 z-50 flex justify-between items-center w-full px-12 py-4 shadow-[0_20px_40px_rgba(25,28,29,0.06)]">
            <div className="flex items-center gap-12">
              <span className="text-xl font-bold tracking-tighter text-white">Digital Sentinel</span>
              <nav className="hidden md:flex gap-8 items-center text-sm">
                <Link href="/training"      className="text-emerald-100/70 hover:text-white transition-colors tracking-tight">Training</Link>
                <Link href="/announcements" className="text-emerald-100/70 hover:text-white transition-colors tracking-tight">Programmes</Link>
                <span className="text-white border-b-2 border-[#DC2E27] pb-1 tracking-tight cursor-default">Dashboard</span>
              </nav>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative">
                <span className="material-symbols-outlined text-white hover:bg-white/10 p-2 rounded-full cursor-pointer transition-all">notifications</span>
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#DC2E27] rounded-full" />
              </div>
              {/* A2.4 — Settings only for HOD+ */}
              {can(userRole, "manage:department") && (
                <span className="material-symbols-outlined text-white hover:bg-white/10 p-2 rounded-full cursor-pointer transition-all">settings</span>
              )}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full border-2 border-emerald-500/30 bg-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-xl">person</span>
                </div>
                <div className="hidden md:block">
                  <p className="text-white text-xs font-bold truncate max-w-[120px]">{userName}</p>
                  <p className="text-emerald-100/50 text-[10px] uppercase tracking-wider">{userRole.replace("_", " ")}</p>
                </div>
              </div>
            </div>
          </header>

          {tracksContent}
        </main>
      </div>
    )
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

    return (
      <div className="bg-surface text-on-surface flex min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
        <aside className="h-screen w-64 fixed left-0 top-0 z-40 bg-slate-50 flex flex-col p-4">
          <div className="mb-10 px-4">
            <h1 className="font-black text-emerald-900 text-xl tracking-tighter">Guardian Portal</h1>
            <p className="text-[0.6875rem] uppercase tracking-widest text-slate-500 font-medium">Biodiversity Unit</p>
          </div>

          <nav className="flex-1 space-y-2">
            {[
              { href: "/dashboard",          icon: "dashboard",   label: "Overview",     active: false },
              { href: "/dashboard/training",  icon: "forest",      label: "Ranger Track", active: false },
              { href: "/dashboard/guides",    icon: "explore",     label: "Guide Track",  active: false },
              { href: "/dashboard/tracks", icon: "trophy",      label: "Tracks",       active: false },
              // Training Modules for HOD+
              ...(hasMinRole(userRole, "HOD") ? [{ href: "/dashboard?action=modules", icon: "school", label: "Training Modules", active: false }] : []),
              // A2.4 — Applications only for HOD+
              ...(hasMinRole(userRole, "HOD") ? [{ href: "/dashboard?action=applications", icon: "person_add", label: "Applications", active: true }] : []),
            ].map(({ href, icon, label, active }) => (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 text-sm font-medium uppercase tracking-widest ${
                  active ? "bg-emerald-100 text-emerald-900 translate-x-1" : "text-slate-500 hover:bg-slate-200"
                }`}
              >
                <span className="material-symbols-outlined">{icon}</span>
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto space-y-2 pt-6">
            <button className="w-full bg-[#DC2E27] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all text-sm">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
              Live Incident
            </button>
            <div className="pt-4 space-y-1">
              <a href="#" className="flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all text-[0.6875rem] uppercase tracking-widest font-medium">
                <span className="material-symbols-outlined text-sm">help</span> Support
              </a>
              <button onClick={handleSignOut} className="w-full flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all text-[0.6875rem] uppercase tracking-widest font-medium">
                <span className="material-symbols-outlined text-sm">logout</span> Sign Out
              </button>
            </div>
          </div>
        </aside>

        <main className="ml-64 flex-1 flex flex-col min-h-screen">
          <header className="bg-emerald-950/90 backdrop-blur-xl sticky top-0 z-50 flex justify-between items-center w-full px-12 py-4 shadow-[0_20px_40px_rgba(25,28,29,0.06)]">
            <div className="flex items-center gap-12">
              <span className="text-xl font-bold tracking-tighter text-white">Digital Sentinel</span>
              <nav className="hidden md:flex gap-8 items-center text-sm">
                <Link href="/training"      className="text-emerald-100/70 hover:text-white transition-colors tracking-tight">Training</Link>
                <Link href="/announcements" className="text-emerald-100/70 hover:text-white transition-colors tracking-tight">Programmes</Link>
                <span className="text-white border-b-2 border-[#DC2E27] pb-1 tracking-tight cursor-default">Dashboard</span>
              </nav>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative">
                <span className="material-symbols-outlined text-white hover:bg-white/10 p-2 rounded-full cursor-pointer transition-all">notifications</span>
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#DC2E27] rounded-full" />
              </div>
              {can(userRole, "manage:department") && (
                <span className="material-symbols-outlined text-white hover:bg-white/10 p-2 rounded-full cursor-pointer transition-all">settings</span>
              )}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full border-2 border-emerald-500/30 bg-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-xl">person</span>
                </div>
                <div className="hidden md:block">
                  <p className="text-white text-xs font-bold truncate max-w-[120px]">{userName}</p>
                  <p className="text-emerald-100/50 text-[10px] uppercase tracking-wider">{userRole.replace("_", " ")}</p>
                </div>
              </div>
            </div>
          </header>

          {applicationsContent}
        </main>
      </div>
    )
  }

  // If the user's saved profile role exists, use it; otherwise fall back to auth metadata.
  const roleToUse = userRole;
  const profileName = userName;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="bg-surface text-on-surface flex min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Sidebar ── */}
      <aside className="h-screen w-64 fixed left-0 top-0 z-40 bg-slate-50 flex flex-col p-4">
        <div className="mb-10 px-4">
          <h1 className="font-black text-emerald-900 text-xl tracking-tighter">Guardian Portal</h1>
          <p className="text-[0.6875rem] uppercase tracking-widest text-slate-500 font-medium">Biodiversity Unit</p>
        </div>

        <nav className="flex-1 space-y-2">
          {[
            { href: "/dashboard",          icon: "dashboard",   label: "Overview",     active: action === 'overview'  },
            { href: "/dashboard/training",  icon: "forest",      label: "Ranger Track", active: false },
            { href: "/dashboard/guides",    icon: "explore",     label: "Guide Track",  active: false },
            { href: "/dashboard/tracks", icon: "trophy",      label: "Tracks",       active: false },
            // Training Modules for HOD+
            ...(hasMinRole(userRole, "HOD") ? [{ href: "/dashboard?action=modules", icon: "school", label: "Training Modules", active: action === 'modules' || action === 'edit' || action === 'new' }] : []),
            // A2.4 — Applications only for HOD+
            ...(hasMinRole(userRole, "HOD") ? [{ href: "/dashboard?action=applications", icon: "person_add", label: "Applications", active: action === 'applications' }] : []),
          ].map(({ href, icon, label, active }) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 text-sm font-medium uppercase tracking-widest ${
                active ? "bg-emerald-100 text-emerald-900 translate-x-1" : "text-slate-500 hover:bg-slate-200"
              }`}
            >
              <span className="material-symbols-outlined">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-2 pt-6">
          <button className="w-full bg-[#DC2E27] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all text-sm">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
            Live Incident
          </button>
          <div className="pt-4 space-y-1">
            <a href="#" className="flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all text-[0.6875rem] uppercase tracking-widest font-medium">
              <span className="material-symbols-outlined text-sm">help</span> Support
            </a>
            <button onClick={handleSignOut} className="w-full flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all text-[0.6875rem] uppercase tracking-widest font-medium">
              <span className="material-symbols-outlined text-sm">logout</span> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="ml-64 flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-emerald-950/90 backdrop-blur-xl sticky top-0 z-50 flex justify-between items-center w-full px-12 py-4 shadow-[0_20px_40px_rgba(25,28,29,0.06)]">
          <div className="flex items-center gap-12">
            <span className="text-xl font-bold tracking-tighter text-white">Digital Sentinel</span>
            <nav className="hidden md:flex gap-8 items-center text-sm">
              <Link href="/training"      className="text-emerald-100/70 hover:text-white transition-colors tracking-tight">Training</Link>
              <Link href="/announcements" className="text-emerald-100/70 hover:text-white transition-colors tracking-tight">Programmes</Link>
              <span className="text-white border-b-2 border-[#DC2E27] pb-1 tracking-tight cursor-default">Dashboard</span>
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative">
              <span className="material-symbols-outlined text-white hover:bg-white/10 p-2 rounded-full cursor-pointer transition-all">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-[#DC2E27] rounded-full" />
            </div>
            {/* A2.4 — Settings only for HOD+ */}
            {can(userRole, "manage:department") && (
              <span className="material-symbols-outlined text-white hover:bg-white/10 p-2 rounded-full cursor-pointer transition-all">settings</span>
            )}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border-2 border-emerald-500/30 bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-xl">person</span>
              </div>
              <div className="hidden md:block">
                <p className="text-white text-xs font-bold truncate max-w-[120px]">{userName}</p>
                <p className="text-emerald-100/50 text-[10px] uppercase tracking-wider">{userRole.replace("_", " ")}</p>
              </div>
            </div>
          </div>
        </header>

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
      </main>
    </div>
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
