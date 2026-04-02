"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Application = {
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
};

type Tab = "PENDING" | "APPROVED" | "REJECTED";

const TAB_CONFIG: Record<Tab, { label: string; icon: string; color: string; badge: string }> = {
  PENDING:  { label: "Pending",  icon: "hourglass_top", color: "text-amber-700",  badge: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Approved", icon: "verified",      color: "text-emerald-700",badge: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Rejected", icon: "cancel",        color: "text-red-700",    badge: "bg-red-100 text-red-800" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

export default function HodDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [apps,       setApps]       = useState<Application[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState<Tab>("PENDING");
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [notes,      setNotes]      = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login?next=/dashboard/hod"); return; }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!profile || !["HOD","SUPERADMIN"].includes(profile.role)) {
        router.push("/unauthorized"); return;
      }

      await loadApps();
    }
    init();
  }, []);

  async function loadApps() {
    setLoading(true);
    const { data } = await supabase
      .from("guide_applications")
      .select("*, training_tracks(title)")
      .order("submitted_at", { ascending: false });
    setApps((data as Application[]) ?? []);
    setLoading(false);
  }

  async function handleApprove(appId: string) {
    setProcessing(appId);
    const { error } = await supabase.rpc("approve_guide_application", {
      p_app_id: appId,
      p_notes:  notes[appId] ?? "",
    });
    setProcessing(null);
    if (error) { showToast(error.message, false); return; }
    showToast("Application approved. Role upgraded to Guide.", true);
    setExpanded(null);
    await loadApps();
  }

  async function handleReject(appId: string) {
    if (!notes[appId]?.trim()) { showToast("Rejection notes are required.", false); return; }
    setProcessing(appId);
    const { error } = await supabase.rpc("reject_guide_application", {
      p_app_id: appId,
      p_notes:  notes[appId].trim(),
    });
    setProcessing(null);
    if (error) { showToast(error.message, false); return; }
    showToast("Application rejected.", true);
    setExpanded(null);
    await loadApps();
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  const filtered = apps.filter(a => a.status === tab);
  const counts = {
    PENDING:  apps.filter(a => a.status === "PENDING").length,
    APPROVED: apps.filter(a => a.status === "APPROVED").length,
    REJECTED: apps.filter(a => a.status === "REJECTED").length,
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      {/* Top bar */}
      <div className="bg-[#012d1d] text-white text-[11px] py-1.5 px-4">
        <span className="opacity-60">Portal Rasmi | Sarawak Forestry Corporation · HoD Panel</span>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[#012d1d] flex items-center justify-center text-sm">🌿</div>
              <span className="text-sm font-extrabold text-[#012d1d] tracking-tight">Digital Sentinel</span>
            </Link>
            <span className="text-gray-300">·</span>
            <span className="text-sm font-semibold text-gray-600">HoD Panel</span>
          </div>
          <Link href="/" className="text-xs font-semibold text-gray-500 hover:text-[#012d1d] transition-colors">← Back to Site</Link>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white
          ${toast.ok ? "bg-emerald-700" : "bg-red-700"}`}>
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
            {toast.ok ? "check_circle" : "error"}
          </span>
          {toast.msg}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Page title + stats */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Guide Applications</h1>
            <p className="text-sm text-gray-500 mt-0.5">Review, approve, or reject certification applications.</p>
          </div>
          <div className="flex gap-3">
            {(["PENDING","APPROVED","REJECTED"] as Tab[]).map(s => (
              <div key={s} className={`text-center px-4 py-2 rounded-xl border ${
                s === "PENDING" ? "bg-amber-50 border-amber-200" :
                s === "APPROVED" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
              }`}>
                <p className={`text-xl font-black ${
                  s === "PENDING" ? "text-amber-700" :
                  s === "APPROVED" ? "text-emerald-700" : "text-red-700"
                }`}>{counts[s]}</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{s}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {(["PENDING","APPROVED","REJECTED"] as Tab[]).map(t => {
            const cfg = TAB_CONFIG[t];
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
                  ${tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                <span className={`material-symbols-outlined text-base ${tab === t ? cfg.color : ""}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
                {cfg.label}
                {counts[t] > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${cfg.badge}`}>
                    {counts[t]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Applications list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-[#012d1d] text-3xl">progress_activity</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">inbox</span>
            <p className="font-semibold text-gray-500">No {tab.toLowerCase()} applications</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(app => {
              const isOpen = expanded === app.id;
              return (
                <div key={app.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  {/* Card header — always visible */}
                  <div className="flex items-center gap-4 p-5">
                    {/* Avatar */}
                    <div className="w-10 h-10 bg-[#012d1d] rounded-full flex items-center justify-center text-white font-black text-sm shrink-0">
                      {app.full_name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900 text-sm">{app.full_name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${TAB_CONFIG[app.status].badge}`}>
                          {app.status}
                        </span>
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

                    <button onClick={() => setExpanded(isOpen ? null : app.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#012d1d] transition-colors shrink-0 px-3 py-2 rounded-lg hover:bg-gray-50">
                      {isOpen ? "Collapse" : "Review"}
                      <span className="material-symbols-outlined text-base">
                        {isOpen ? "expand_less" : "expand_more"}
                      </span>
                    </button>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
                      {/* Contact */}
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

                      {/* Motivation */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Motivation</p>
                        <p className="text-sm text-gray-800 leading-relaxed">{app.motivation}</p>
                      </div>

                      {/* Experience */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Prior Experience</p>
                        <p className="text-sm text-gray-800 leading-relaxed">{app.experience}</p>
                      </div>

                      {/* Existing reviewer notes (if already reviewed) */}
                      {app.status !== "PENDING" && app.reviewer_notes && (
                        <div className={`rounded-xl p-4 ${app.status === "APPROVED" ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Your Notes</p>
                          <p className="text-sm text-gray-800 leading-relaxed">{app.reviewer_notes}</p>
                          <p className="text-[10px] text-gray-400 mt-2">Reviewed on {app.reviewed_at ? formatDate(app.reviewed_at) : "—"}</p>
                        </div>
                      )}

                      {/* Review actions (PENDING only) */}
                      {app.status === "PENDING" && (
                        <div className="space-y-3 pt-1">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1.5">
                              Notes for Applicant
                              <span className="text-red-500 ml-1">* required for rejection</span>
                            </label>
                            <textarea
                              rows={3}
                              value={notes[app.id] ?? ""}
                              onChange={e => setNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                              placeholder="Optional for approval. Required if rejecting — explain the reason clearly."
                              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-[#012d1d]/20 focus:border-[#012d1d] transition-all"
                            />
                          </div>

                          <div className="flex gap-3 justify-end">
                            <button
                              onClick={() => handleReject(app.id)}
                              disabled={processing === app.id}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-red-200 text-red-700 font-semibold text-sm hover:bg-red-50 transition-all disabled:opacity-50"
                            >
                              {processing === app.id
                                ? <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                                : <span className="material-symbols-outlined text-base">cancel</span>
                              }
                              Reject
                            </button>
                            <button
                              onClick={() => handleApprove(app.id)}
                              disabled={processing === app.id}
                              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#012d1d] text-white font-semibold text-sm hover:bg-[#024a2f] transition-all disabled:opacity-50"
                            >
                              {processing === app.id
                                ? <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                                : <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                              }
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
      </main>
    </div>
  );
}
