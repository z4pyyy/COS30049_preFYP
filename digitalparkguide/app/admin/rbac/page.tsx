"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS, ROLE_HIERARCHY, type AppRole } from "@/types/roles";

type PageAccess = {
  id: string;
  route: string;
  label: string;
  group_name: string;
  min_role: AppRole;
  is_locked: boolean;
  is_disabled: boolean;
};

const ROLES_ASC: AppRole[] = ["PUBLIC_USER", "GUIDE", "SENIOR_GUIDE", "HOD", "SUPERADMIN"];

const ROLE_BADGE: Record<AppRole, string> = {
  SUPERADMIN:   "bg-red-100 text-red-800",
  HOD:          "bg-purple-100 text-purple-800",
  SENIOR_GUIDE: "bg-blue-100 text-blue-800",
  GUIDE:        "bg-emerald-100 text-emerald-800",
  PUBLIC_USER:  "bg-slate-100 text-slate-600",
};

const GROUP_ICON: Record<string, string> = {
  "Admin Console":  "admin_panel_settings",
  "Staff Dashboard":"dashboard",
  "Training":       "school",
  "Public":         "public",
};

export default function RbacPage() {
  const [pages,      setPages]      = useState<PageAccess[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);

  const supabase = createClient();

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase
      .from("page_access")
      .select("*")
      .order("group_name")
      .order("route");
    if (error) { showToast("Failed to load: " + error.message, false); setLoading(false); return; }
    const rows = (data ?? []) as PageAccess[];
    setPages(rows);
    // All groups open by default
    const groups = [...new Set(rows.map((r) => r.group_name))];
    setOpenGroups(Object.fromEntries(groups.map((g) => [g, true])));
    setLoading(false);
  }

  async function updatePage(id: string, patch: Partial<PageAccess>) {
    setSaving(id);
    const { error } = await supabase.from("page_access").update(patch).eq("id", id);
    setSaving(null);
    if (error) {
      showToast("Failed: " + error.message, false);
    } else {
      setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      showToast("Saved.", true);
    }
  }

  async function bulkUpdateGroup(groupName: string, patch: Partial<PageAccess>) {
    const targets = pages.filter((p) => p.group_name === groupName && !p.is_locked);
    if (targets.length === 0) { showToast("All pages in this group are locked.", false); return; }
    await Promise.all(
      targets.map((p) => supabase.from("page_access").update(patch).eq("id", p.id))
    );
    setPages((prev) =>
      prev.map((p) => (p.group_name === groupName && !p.is_locked ? { ...p, ...patch } : p))
    );
    showToast(`Updated ${targets.length} pages in "${groupName}".`, true);
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function toggleGroup(name: string) {
    setOpenGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  // Build grouped structure
  const groupNames = [...new Set(pages.map((p) => p.group_name))];
  const grouped = groupNames.map((name) => ({
    name,
    pages: pages.filter((p) => p.group_name === name),
  }));

  return (
    <>
      {/* Header */}
      <header className="bg-emerald-950/95 backdrop-blur-xl sticky top-0 z-50 flex justify-between items-center px-10 py-4 shadow-lg">
        <div>
          <h1 className="text-white font-black text-lg tracking-tight">RBAC Settings</h1>
          <p className="text-emerald-400/60 text-[0.625rem] uppercase tracking-widest">
            Dynamic route access control — changes apply immediately
          </p>
        </div>
        <span className="text-[0.625rem] bg-white/10 text-white px-3 py-1 rounded-full font-bold uppercase tracking-widest">
          {pages.length} Routes · {groupNames.length} Groups
        </span>
      </header>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white transition-all
          ${toast.ok ? "bg-emerald-700" : "bg-red-700"}`}>
          <span className="material-symbols-outlined text-base"
            style={{ fontVariationSettings: "'FILL' 1" }}>
            {toast.ok ? "check_circle" : "error"}
          </span>
          {toast.msg}
        </div>
      )}

      <section className="p-8 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
            <span className="text-sm font-medium">Loading access rules…</span>
          </div>
        ) : (
          <>
            {grouped.map((group) => {
              const isOpen = openGroups[group.name] ?? true;
              const disabledCount  = group.pages.filter((p) => p.is_disabled).length;
              const editablePages  = group.pages.filter((p) => !p.is_locked);
              const uniqueRoles    = [...new Set(group.pages.filter(p => !p.is_disabled).map((p) => p.min_role))];

              return (
                <div key={group.name} className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden shadow-sm">

                  {/* ── Group header ── */}
                  <div className="flex items-center gap-0 border-b border-outline-variant/10">
                    {/* Expand/collapse button */}
                    <button
                      onClick={() => toggleGroup(group.name)}
                      className="flex items-center gap-4 flex-1 px-6 py-4 hover:bg-surface-container-low transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary text-lg">
                          {GROUP_ICON[group.name] ?? "folder"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-on-surface">{group.name}</h2>
                        <p className="text-xs text-on-surface-variant">
                          {group.pages.length} page{group.pages.length !== 1 ? "s" : ""}
                          {disabledCount > 0 && (
                            <span className="ml-2 text-red-600 font-semibold">
                              · {disabledCount} disabled
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Role summary badges */}
                      <div className="flex gap-1.5 flex-wrap">
                        {disabledCount > 0 && (
                          <span className="text-[0.625rem] px-2 py-0.5 rounded-full font-bold uppercase bg-red-100 text-red-700">
                            {disabledCount} disabled
                          </span>
                        )}
                        {uniqueRoles.map((r) => (
                          <span key={r} className={`text-[0.625rem] px-2 py-0.5 rounded-full font-bold uppercase ${ROLE_BADGE[r]}`}>
                            {ROLE_LABELS[r]}+
                          </span>
                        ))}
                      </div>

                      <span className="material-symbols-outlined text-on-surface-variant text-xl ml-2">
                        {isOpen ? "expand_less" : "expand_more"}
                      </span>
                    </button>

                    {/* Group-level bulk action */}
                    {editablePages.length > 0 && (
                      <div className="px-4 py-4 border-l border-outline-variant/10 shrink-0 flex items-center gap-2">
                        <span className="text-[0.6875rem] text-on-surface-variant font-medium whitespace-nowrap hidden sm:block">
                          Apply to all:
                        </span>
                        <select
                          className="text-xs bg-surface-container-high rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-primary/20 font-semibold cursor-pointer"
                          value=""
                          onChange={async (e) => {
                            const val = e.target.value;
                            if (!val) return;
                            if (val === "DISABLE") {
                              await bulkUpdateGroup(group.name, { is_disabled: true });
                            } else if (val === "ENABLE") {
                              await bulkUpdateGroup(group.name, { is_disabled: false });
                            } else {
                              await bulkUpdateGroup(group.name, { min_role: val as AppRole, is_disabled: false });
                            }
                            e.target.value = "";
                          }}
                        >
                          <option value="">Bulk action…</option>
                          <option value="DISABLE">🚫 Disable all</option>
                          <option value="ENABLE">✅ Enable all</option>
                          <option disabled>──────────</option>
                          {ROLES_ASC.map((r) => (
                            <option key={r} value={r}>
                              Require {ROLE_LABELS[r]}+
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* ── Pages list ── */}
                  {isOpen && (
                    <div>
                      {group.pages.map((page, idx) => (
                        <div
                          key={page.id}
                          className={`flex items-center gap-4 px-6 py-3.5 border-b border-outline-variant/10 last:border-0 transition-colors
                            ${page.is_disabled
                              ? "bg-red-50/40"
                              : idx % 2 === 0
                              ? "bg-surface-container-lowest"
                              : "bg-surface-container-low/30"
                            }`}
                        >
                          {/* Status icon */}
                          <span
                            className={`material-symbols-outlined text-lg shrink-0
                              ${page.is_locked   ? "text-on-surface-variant/50"
                              : page.is_disabled ? "text-red-500"
                              :                   "text-emerald-500"}`}
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {page.is_locked ? "lock" : page.is_disabled ? "block" : "lock_open"}
                          </span>

                          {/* Page info */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-sm ${page.is_disabled ? "text-on-surface/50 line-through" : "text-on-surface"}`}>
                              {page.label}
                            </p>
                            <code className="text-[0.6875rem] font-mono text-on-surface-variant">
                              {page.route}/*
                            </code>
                          </div>

                          {/* Current status badge */}
                          {page.is_disabled ? (
                            <span className="text-[0.625rem] px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-bold uppercase tracking-wider shrink-0">
                              Disabled
                            </span>
                          ) : (
                            <div className="shrink-0 flex items-center gap-1.5">
                              <span className={`text-[0.625rem] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${ROLE_BADGE[page.min_role]}`}>
                                {ROLE_LABELS[page.min_role]}+
                              </span>
                              <span className="text-[0.625rem] text-on-surface-variant">
                                rank {ROLE_HIERARCHY[page.min_role]}+
                              </span>
                            </div>
                          )}

                          {/* Controls */}
                          {page.is_locked ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="material-symbols-outlined text-sm text-on-surface-variant/50">lock</span>
                              <span className="text-[0.6875rem] text-on-surface-variant/50 italic">Protected</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Disable / Enable toggle */}
                              <button
                                onClick={() => updatePage(page.id, { is_disabled: !page.is_disabled })}
                                disabled={saving === page.id}
                                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all disabled:opacity-50
                                  ${page.is_disabled
                                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                    : "bg-red-100 text-red-700 hover:bg-red-200"
                                  }`}
                              >
                                {page.is_disabled ? "Enable" : "Disable"}
                              </button>

                              {/* Min role selector */}
                              <select
                                value={page.min_role}
                                disabled={saving === page.id || page.is_disabled}
                                onChange={(e) =>
                                  updatePage(page.id, { min_role: e.target.value as AppRole })
                                }
                                className="text-xs bg-surface-container-high rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-primary/20 font-semibold disabled:opacity-40 cursor-pointer"
                              >
                                {ROLES_ASC.map((r) => (
                                  <option key={r} value={r}>
                                    {ROLE_LABELS[r]}+
                                  </option>
                                ))}
                              </select>

                              {saving === page.id && (
                                <span className="material-symbols-outlined animate-spin text-primary text-base">
                                  progress_activity
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {[
                { icon: "lock_open",  color: "text-emerald-500", title: "Active",   desc: "Route is accessible to users meeting the minimum role." },
                { icon: "block",      color: "text-red-500",     title: "Disabled", desc: "Route returns 401 for everyone except Superadmin." },
                { icon: "lock",       color: "text-slate-400",   title: "Locked",   desc: "Admin Console routes — cannot be changed." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/10">
                  <span className={`material-symbols-outlined text-xl mt-0.5 ${item.color}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}>
                    {item.icon}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-on-surface">{item.title}</p>
                    <p className="text-[0.6875rem] text-on-surface-variant mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200/60 rounded-xl p-4">
              <span className="material-symbols-outlined text-blue-600 text-xl mt-0.5">info</span>
              <div>
                <p className="text-xs font-bold text-blue-900">Changes apply on the next request</p>
                <p className="text-[0.6875rem] text-blue-700/80 mt-0.5 leading-relaxed">
                  Route rules are read from the database by the server middleware on every request.
                  No rebuild required. Locked routes (Admin Console) are enforced regardless of settings.
                </p>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
