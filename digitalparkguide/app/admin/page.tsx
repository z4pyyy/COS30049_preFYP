import { createClient } from "@/lib/supabase/server";

const FEED_ITEMS = [
  {
    id: 1,
    icon: "report_problem",
    iconBg: "bg-red-100",
    iconColor: "text-red-700",
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
    title: "System Update: Biodiversity 2.4",
    time: "1 HOUR AGO",
    body: "New AR overlays added for orchid identification in Guide Track.",
    action: "Release Notes",
  },
];

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Real stats from DB
  const [
    { count: userCount },
    { count: announcementCount },
    { count: trackCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("announcements").select("*", { count: "exact", head: true }).eq("published", true),
    supabase.from("training_tracks").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Registered Users",       value: String(userCount ?? 0),    note: "All roles",        accent: "border-primary",    color: "text-primary" },
    { label: "Training Tracks",        value: String(trackCount ?? 0),   note: "Active tracks",    accent: "border-primary",    color: "text-primary" },
    { label: "Published Announcements",value: String(announcementCount ?? 0), note: "Live now", accent: "border-secondary",  color: "text-secondary" },
    { label: "System Health",          value: "9.4",                     note: "Operational",      accent: "border-emerald-500",color: "text-emerald-700" },
  ];

  return (
    <>

      <section className="p-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((s) => (
            <div key={s.label} className={`bg-surface-container-low p-6 rounded-xl border-l-4 ${s.accent} space-y-2`}>
              <p className="text-on-surface-variant uppercase text-[0.6875rem] font-bold tracking-widest">{s.label}</p>
              <div className="flex items-end justify-between">
                <span className={`text-3xl font-black ${s.color}`}>{s.value}</span>
                <span className="text-xs font-bold text-on-surface-variant/60">{s.note}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-12 gap-8 items-start">
          {/* Main feed */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm">
              <div className="relative h-56 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&q=80"
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent flex flex-col justify-end p-8">
                  <h2 className="text-white text-2xl font-bold tracking-tight">Zone Alpha Surveillance</h2>
                  <p className="text-emerald-100/80 text-sm max-w-md mt-1">
                    Real-time biodiversity monitoring and training track integration for Bako National Park.
                  </p>
                </div>
                <div className="absolute top-4 right-4 flex gap-2">
                  <span className="bg-primary/60 backdrop-blur-md text-white text-[0.625rem] px-3 py-1 rounded-full uppercase tracking-tighter border border-white/20">Live GPS Active</span>
                  <span className="bg-red-700/60 backdrop-blur-md text-white text-[0.625rem] px-3 py-1 rounded-full uppercase tracking-tighter border border-white/20">AI Detection On</span>
                </div>
              </div>

              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-primary">Training Alerts & Incidents</h3>
                  <span className="text-primary text-xs font-bold flex items-center gap-1">
                    Mock Data <span className="material-symbols-outlined text-xs">info</span>
                  </span>
                </div>
                <div className="space-y-3">
                  {FEED_ITEMS.map((item) => (
                    <div key={item.id} className="flex items-center gap-5 p-4 bg-surface-container-low rounded-xl group hover:bg-surface-container-high transition-all">
                      <div className={`h-11 w-11 rounded-full ${item.iconBg} flex items-center justify-center ${item.iconColor} shrink-0`}>
                        <span className="material-symbols-outlined text-xl"
                          style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-primary text-sm">{item.title}</h4>
                          <span className="text-[0.625rem] text-on-surface-variant font-medium shrink-0">{item.time}</span>
                        </div>
                        <p className="text-xs text-secondary mt-0.5 truncate">{item.body}</p>
                      </div>
                      <button className="bg-primary text-white text-xs px-3 py-1.5 rounded-lg font-bold opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        {item.action}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-primary">Active Patrols</h3>
                <span className="text-[0.625rem] text-emerald-600 bg-emerald-50 px-2 py-1 rounded font-bold uppercase">12 Teams</span>
              </div>
              <div className="aspect-video rounded-xl overflow-hidden relative border border-outline-variant/15">
                <img
                  src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&q=60"
                  alt=""
                  className="w-full h-full object-cover grayscale brightness-50"
                />
                <div className="absolute inset-0 bg-primary/20" />
                <div className="absolute top-3 left-3 space-y-1">
                  <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                    <span className="text-[0.5rem] font-bold text-primary uppercase">POI 02: Alert</span>
                  </div>
                  <div className="bg-emerald-950/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[0.5rem] font-bold text-white uppercase">Team Alpha: Active</span>
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 text-[8px] text-emerald-400/80 font-mono leading-tight text-right">
                  LAT: 1.5533° N<br />LON: 110.3592° E
                </div>
              </div>

              {[
                { name: "Sgt. Tan Boon", track: "Ranger Track Lv.4", progress: 66 },
                { name: "Rgr. Siti Aminah", track: "Guide Track Lv.2", progress: 33 },
              ].map((p) => (
                <div key={p.name} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-lg">person</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-primary truncate">{p.name}</p>
                    <p className="text-[10px] text-secondary">{p.track}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-mono text-emerald-700">Patrolling</p>
                    <div className="h-1 w-12 bg-emerald-100 rounded-full mt-1">
                      <div className="h-1 bg-emerald-500 rounded-full" style={{ width: `${p.progress}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-primary text-white p-6 rounded-xl space-y-4 relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-xs font-bold text-emerald-100 uppercase tracking-widest">Incident Response Time</h3>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-black">4.2m</span>
                  <span className="text-emerald-400 text-xs">−1.8m from last month</span>
                </div>
                <div className="mt-5 h-10 flex items-end gap-1">
                  {[4, 6, 8, 12, 7, 10, 12].map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-t transition-all hover:opacity-100 ${i === 6 ? "bg-red-500" : "bg-white/20 hover:bg-white/40"}`}
                      style={{ height: `${(h / 12) * 100}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className="absolute -right-10 -top-10 w-28 h-28 bg-white/5 rounded-full blur-2xl" />
              <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-emerald-400/5 rounded-full blur-xl" />
            </div>
          </div>
        </div>
      </section>

      <footer className="w-full py-6 mt-auto bg-emerald-950 flex justify-between items-center px-10 text-xs text-emerald-100/50 border-t border-white/5">
        <span>Digital Sentinel · Guardian Portal</span>
        <span>© 2024 Sarawak Forestry Corporation. All rights reserved.</span>
      </footer>
    </>
  );
}