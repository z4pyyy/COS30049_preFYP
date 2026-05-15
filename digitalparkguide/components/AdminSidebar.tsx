'use client'

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import BackToSiteButton from "@/components/BackToSiteButton";

const NAV = [
  { href: "/admin",        icon: "dashboard",     label: "Overview" },
  { href: "/admin/users",  icon: "group",         label: "Users" },
  { href: "/admin/rbac",   icon: "shield_person", label: "RBAC" },
  { href: "/monitor",      icon: "videocam",      label: "Monitor" },
];

export default function AdminSidebar({
  fullName,
  initials,
}: {
  fullName: string;
  initials: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Mobile menu trigger — slides below the unified TopNav */}
      <div className="lg:hidden sticky top-(--nav-height) z-30 h-14 bg-slate-50 border-b border-outline-variant/20 flex items-center px-4">
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-emerald-50 text-slate-700"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <p className="ml-3 text-[0.6875rem] uppercase tracking-widest text-slate-500 font-bold">Superadmin Menu</p>
      </div>

      {/* Backdrop (mobile only) */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-[65] bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — sits below the TopNav on desktop */}
      <aside
        className={`fixed left-0 top-0 lg:top-(--nav-height) z-70 lg:z-30 h-screen lg:h-[calc(100vh-var(--nav-height))] w-64 bg-slate-50 flex flex-col p-4 border-r border-outline-variant/20 transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 px-4 flex items-start justify-end lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-emerald-50 text-slate-600 -mr-2"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
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
          <BackToSiteButton />
          <div className="flex items-center gap-3 px-4 py-3 mt-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-black">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-on-surface truncate">{fullName}</p>
              <p className="text-[0.625rem] text-on-surface-variant uppercase tracking-widest">Superadmin</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
