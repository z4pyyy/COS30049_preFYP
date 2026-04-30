"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS, type AppRole } from "@/types/roles";
import ThemedSelect from "@/components/ThemedSelect";

type Profile = {
  id: string;
  full_name: string;
  role: AppRole;
  created_at: string;
  email?: string;
};

const ROLE_BADGE: Record<AppRole, string> = {
  SUPERADMIN:   "bg-red-100 text-red-800",
  HOD:          "bg-purple-100 text-purple-800",
  SENIOR_GUIDE: "bg-blue-100 text-blue-800",
  GUIDE:        "bg-emerald-100 text-emerald-800",
  PUBLIC_USER:  "bg-slate-100 text-slate-600",
};

const ASSIGNABLE_ROLES: AppRole[] = ["HOD", "SENIOR_GUIDE", "GUIDE", "PUBLIC_USER"];

export default function UsersPage() {
  const [profiles,  setProfiles]  = useState<Profile[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState<AppRole | "ALL">("ALL");
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role, created_at")
        .order("created_at", { ascending: false });
      setProfiles((data as Profile[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleDelete(profile: Profile) {
    setDeleting(profile.id);
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/admin/users/${profile.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json.error || "Failed to delete user.", false);
        return;
      }
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
      showToast(`Deleted ${profile.full_name || "user"}.`, true);
    } finally {
      setDeleting(null);
    }
  }

  async function handleRoleChange(userId: string, newRole: AppRole) {
    setSaving(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);
    setSaving(null);
    if (error) {
      showToast("Failed to update role: " + error.message, false);
    } else {
      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, role: newRole } : p))
      );
      showToast("Role updated successfully.", true);
    }
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const filtered = profiles.filter((p) => {
    const matchSearch =
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.includes(search);
    const matchFilter = filter === "ALL" || p.role === filter;
    return matchSearch && matchFilter;
  });

  return (
    <>
      <header className="bg-emerald-950/95 backdrop-blur-xl sticky top-0 z-50 flex justify-between items-center px-10 py-4 shadow-lg">
        <div>
          <h1 className="text-white font-black text-lg tracking-tight">User Management</h1>
          <p className="text-emerald-400/60 text-[0.625rem] uppercase tracking-widest">
            {profiles.length} registered users
          </p>
        </div>
      </header>

      <section className="p-8 space-y-6">
        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
            <div
              className="bg-surface-container-lowest rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-red-700">warning</span>
                </div>
                <div>
                  <h3 className="font-black text-on-surface">Delete user?</h3>
                  <p className="text-sm text-on-surface-variant mt-1">
                    This permanently removes <span className="font-bold text-on-surface">{confirmDelete.full_name || "this user"}</span> and their sign-in credentials. This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(confirmDelete)}
                  className="px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-widest bg-red-700 text-white hover:bg-red-800 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-medium text-white transition-all
            ${toast.ok ? "bg-emerald-700" : "bg-red-700"}`}>
            <span className="material-symbols-outlined text-base">
              {toast.ok ? "check_circle" : "error"}
            </span>
            {toast.msg}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-56 max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
            <input
              type="text"
              placeholder="Search by name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-container-high rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {(["ALL", ...Object.keys(ROLE_LABELS)] as (AppRole | "ALL")[]).map((r) => (
              <button
                key={r}
                onClick={() => setFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all
                  ${filter === r
                    ? "bg-primary text-white"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                  }`}
              >
                {r === "ALL" ? "All" : ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/10">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              Loading users…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-2">group_off</span>
              <p className="text-sm font-medium">No users found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant/20 bg-surface-container-low">
                  <th className="text-left px-6 py-3 text-[0.6875rem] uppercase tracking-widest text-on-surface-variant font-bold">Name</th>
                  <th className="text-left px-6 py-3 text-[0.6875rem] uppercase tracking-widest text-on-surface-variant font-bold">User ID</th>
                  <th className="text-left px-6 py-3 text-[0.6875rem] uppercase tracking-widest text-on-surface-variant font-bold">Current Role</th>
                  <th className="text-left px-6 py-3 text-[0.6875rem] uppercase tracking-widest text-on-surface-variant font-bold">Joined</th>
                  <th className="text-left px-6 py-3 text-[0.6875rem] uppercase tracking-widest text-on-surface-variant font-bold">Assign Role</th>
                  <th className="text-right px-6 py-3 text-[0.6875rem] uppercase tracking-widest text-on-surface-variant font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((profile, idx) => (
                  <tr
                    key={profile.id}
                    className={`border-b border-outline-variant/10 hover:bg-surface-container-low transition-colors
                      ${idx % 2 === 0 ? "" : "bg-surface-container-lowest/50"}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-black shrink-0">
                          {(profile.full_name || "?").slice(0, 1).toUpperCase()}
                        </div>
                        <span className="font-semibold text-on-surface">
                          {profile.full_name || <span className="text-on-surface-variant italic">No name</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-[0.6875rem] text-on-surface-variant">{profile.id.slice(0, 8)}…</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6875rem] font-bold uppercase tracking-wider ${ROLE_BADGE[profile.role]}`}>
                        {ROLE_LABELS[profile.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant text-xs">
                      {new Date(profile.created_at).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-6 py-4">
                      {profile.role === "SUPERADMIN" ? (
                        <span className="text-[0.6875rem] text-on-surface-variant italic">Protected</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <ThemedSelect
                            defaultValue={profile.role}
                            disabled={saving === profile.id}
                            onChange={(v) => handleRoleChange(profile.id, v as AppRole)}
                            options={ASSIGNABLE_ROLES.map(r => ({ value: r, label: ROLE_LABELS[r] }))}
                          />
                          {saving === profile.id && (
                            <span className="material-symbols-outlined animate-spin text-primary text-base">progress_activity</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {profile.role === "SUPERADMIN" ? (
                        <span className="text-[0.6875rem] text-on-surface-variant italic">—</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(profile)}
                          disabled={deleting === profile.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          aria-label={`Delete ${profile.full_name || "user"}`}
                        >
                          {deleting === profile.id ? (
                            <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                          ) : (
                            <span className="material-symbols-outlined text-base">delete</span>
                          )}
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
