import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminSidebar from "@/components/AdminSidebar";
import TopNav from "@/components/TopNav";

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

  const fullName = profile?.full_name || "Superadmin";
  const initials = (profile?.full_name || user.email || "S")
    .split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      <TopNav context="Superadmin Console" />
      <div className="flex flex-1">
        <AdminSidebar fullName={fullName} initials={initials} />

        {/* Page content */}
        <main className="flex-1 flex flex-col lg:ml-64 pt-14 lg:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}
