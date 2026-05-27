import { createClient } from "@/lib/supabase/server";
import BadgeRenewalSetting from "@/components/BadgeRenewalSetting";
import IoTMonitorSection from "@/components/dashboard/iot/IoTMonitorSection";

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

      <section className="p-4 sm:p-6 lg:p-8 space-y-8">
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

        {/* IoT Sensor Monitor + Badge Renewal sidebar */}
        <div className="grid grid-cols-12 gap-8 items-start">
          <div className="col-span-12 lg:col-span-8">
            <IoTMonitorSection />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <BadgeRenewalSetting />
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