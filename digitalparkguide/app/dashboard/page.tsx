"use client";

// A2.4 — Superadmin Dashboard with role-based UI guards
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { can, type AppRole } from "@/types/roles";
import type { User } from "@supabase/supabase-js";

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

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUser(user);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
      </div>
    );
  }

  const userRole = (user?.user_metadata?.role ?? "GUIDE") as AppRole;
  const userName = user?.user_metadata?.full_name ?? user?.email ?? "Guardian";

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
            { href: "/dashboard",          icon: "dashboard",   label: "Overview",     active: true  },
            { href: "/dashboard/training",  icon: "forest",      label: "Ranger Track", active: false },
            { href: "/dashboard/guides",    icon: "explore",     label: "Guide Track",  active: false },
            { href: "/dashboard/incidents", icon: "warning",     label: "Incidents",    active: false },
            // A2.4 — Analytics only for HOD+
            ...(can(userRole, "view:reports") ? [{ href: "/dashboard/analytics", icon: "leaderboard", label: "Analytics", active: false }] : []),
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

              {/* A2.4 — Analytics widget only for HOD+ */}
              {can(userRole, "view:reports") && (
                <div className="bg-primary text-white p-6 rounded-xl space-y-4 relative overflow-hidden">
                  <div className="relative z-10">
                    <h3 className="text-sm font-bold text-emerald-100 uppercase tracking-widest">Incident Response Time</h3>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black">4.2m</span>
                      <span className="text-emerald-400 text-xs">-1.8m from last month</span>
                    </div>
                    <div className="mt-6 h-12 flex items-end gap-1">
                      {BAR_HEIGHTS.map((h, i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-t hover:bg-white/40 transition-all ${h} ${
                            i === BAR_HEIGHTS.length - 1 ? "bg-[#DC2E27]" : "bg-white/10"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="absolute -right-12 -top-12 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
                  <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-emerald-400/5 rounded-full blur-xl" />
                </div>
              )}
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
