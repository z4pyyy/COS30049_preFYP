// Unified site-wide top navigation. Based on the landing page nav.
// Server component — reads auth state + profile role, delegates to TopNavView.
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import TopNavView from "@/components/TopNavView";
import type { AppRole } from "@/types/roles";

type NavKey = "home" | "training" | "announcements" | "biodiversity" | "about";

async function getAuthSnapshot() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { user: null, role: null as AppRole | null };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    return { user, role: (profile?.role ?? null) as AppRole | null };
  } catch {
    return { user: null, role: null as AppRole | null };
  }
}

export default async function TopNav({ active, context }: { active?: NavKey; context?: string }) {
  const { user, role } = await getAuthSnapshot();
  return (
    <TopNavView
      active={active}
      authed={!!user}
      name={user?.user_metadata?.full_name ?? ""}
      email={user?.email ?? ""}
      role={role}
      context={context}
    />
  );
}
