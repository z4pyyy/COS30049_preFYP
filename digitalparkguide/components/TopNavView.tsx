// Pure presentational top nav — no data-fetching.
// Used directly by client components (e.g. dashboard) that already know user/role.
// Server component `TopNav` wraps this after fetching auth.
"use client";

import Link from "next/link";
import ProfileDropdown from "@/components/ProfileDropdown";
import type { AppRole } from "@/types/roles";

type NavKey = "home" | "training" | "announcements" | "biodiversity" | "about";

export interface TopNavViewProps {
  active?: NavKey;
  authed: boolean;
  name?: string;
  email?: string;
  role: AppRole | null;
}

function dashboardHref(role: AppRole | null): string {
  switch (role) {
    case "SUPERADMIN": return "/admin";
    case "HOD":        return "/dashboard/hod";
    default:           return "/dashboard";
  }
}

const NAV_ITEMS: { key: NavKey; label: string; href: string }[] = [
  { key: "home",          label: "Home",          href: "/" },
  { key: "training",      label: "Training",      href: "/training" },
  { key: "announcements", label: "Announcements", href: "/announcements" },
  { key: "biodiversity",  label: "Biodiversity",  href: "/biodiversity" },
  { key: "about",         label: "About SFC",     href: "/about" },
];

export default function TopNavView({ active, authed, name, email, role }: TopNavViewProps) {
  const isPublic = !authed || role === "PUBLIC_USER";

  return (
    <>
      <div className="bg-[#012d1d] text-white text-[11px] py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="opacity-60">Portal Rasmi | Sarawak Forestry Corporation</span>
          <div className="flex items-center gap-4 opacity-60">
            <a href="#" className="hover:opacity-100">BM</a>
            <span>|</span>
            <a href="#" className="hover:opacity-100">EN</a>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#012d1d] flex items-center justify-center">
                <span className="text-white text-lg">🌿</span>
              </div>
              <div className="leading-none">
                <div className="text-sm font-extrabold text-[#012d1d] tracking-tight">Digital Sentinel</div>
                <div className="text-[10px] text-gray-500 font-medium">Sarawak Forestry Corporation</div>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map(({ key, label, href }) => {
                const isActive = key === active;
                return (
                  <Link
                    key={key}
                    href={href}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? "text-[#012d1d] bg-gray-100"
                        : "text-gray-600 hover:text-[#012d1d] hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              {authed ? (
                <>
                  {isPublic ? (
                    <Link
                      href="/apply-guide"
                      className="flex items-center gap-1.5 bg-[#012d1d] text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-[#024a2f] transition-colors"
                    >
                      <span className="text-base leading-none">✦</span>
                      Register as Guide
                    </Link>
                  ) : (
                    <Link
                      href={dashboardHref(role)}
                      className="flex items-center gap-1.5 bg-[#012d1d] text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-[#024a2f] transition-colors"
                    >
                      <span className="material-symbols-outlined text-base leading-none">dashboard</span>
                      Dashboard
                    </Link>
                  )}
                  <ProfileDropdown name={name ?? ""} email={email ?? ""} role={role} />
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm font-medium text-gray-600 hover:text-[#012d1d] px-3 py-2 rounded-md transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="flex items-center gap-1.5 bg-[#012d1d] text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-[#024a2f] transition-colors"
                  >
                    <span className="text-base leading-none">✦</span>
                    Register as Guide
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
