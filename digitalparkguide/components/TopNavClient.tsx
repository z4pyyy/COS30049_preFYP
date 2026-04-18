// Client-side self-fetching wrapper around TopNavView.
// Use this in "use client" pages that don't already have user/role in state.
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TopNavView from "@/components/TopNavView";
import type { AppRole } from "@/types/roles";

type NavKey = "home" | "training" | "announcements" | "biodiversity" | "about";

export default function TopNavClient({ active, context }: { active?: NavKey; context?: string }) {
  const [authed, setAuthed] = useState(false);
  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");
  const [role, setRole]     = useState<AppRole | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthed(false); return; }
      setAuthed(true);
      setName(user.user_metadata?.full_name ?? "");
      setEmail(user.email ?? "");
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      setRole((profile?.role ?? null) as AppRole | null);
    })();
  }, []);

  return <TopNavView active={active} authed={authed} name={name} email={email} role={role} context={context} />;
}
