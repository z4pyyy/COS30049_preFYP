import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/admin",       icon: "dashboard",    label: "Overview" },
  { href: "/admin/users", icon: "group",        label: "Users" },
  { href: "/admin/rbac",  icon: "shield_person", label: "RBAC" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "SUPERADMIN") redirect("/unauthorized");

  const initials = (profile?.full_name || user.email || "S")
    .split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="bg-surface text-on-surface flex min-h-screen">
      {/* Sidebar */}
      <aside className="h-screen w-64 fixed left-0 top-0 z-40 bg-slate-50 flex flex-col p-4 border-r border-outline-variant/20">
        <div className="mb-10 px-4">
          <h1 className="font-black text-emerald-900 text-xl tracking-tighter">Guardian Portal</h1>
          <p className="text-[0.6875rem] uppercase tracking-widest text-slate-500 font-medium">Superadmin Console</p>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV.map(({ href, icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 text-slate-600 px-4 py-3 hover:bg-emerald-50 hover:text-emerald-900 rounded-xl transition-all group"
            >
              <span className="material-symbols-outlined text-xl group-hover:text-emerald-700">{icon}</span>
              <span className="font-medium text-sm uppercase tracking-widest">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-outline-variant/20">
          <Link href="/" className="flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-100 rounded-xl transition-all text-sm">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span className="font-medium text-[0.6875rem] uppercase tracking-widest">Back to Site</span>
          </Link>
          <div className="flex items-center gap-3 px-4 py-3 mt-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-black">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-on-surface truncate">{profile?.full_name || "Superadmin"}</p>
              <p className="text-[0.625rem] text-on-surface-variant uppercase tracking-widest">Superadmin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Page content */}
      <main className="ml-64 flex-1 flex flex-col min-h-screen">
        {children}
      </main>
    </div>
  );
}
