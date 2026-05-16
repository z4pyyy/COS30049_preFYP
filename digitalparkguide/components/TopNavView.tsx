"use client";

import Link from "next/link";
import ProfileDropdown from "@/components/ProfileDropdown";
import NotificationBell from "@/components/NotificationBell";
import type { AppRole } from "@/types/roles";

type NavKey = "home" | "training" | "announcements"  | "about";

export interface TopNavViewProps {
  active?: NavKey;
  authed: boolean;
  name?: string;
  email?: string;
  role: AppRole | null;
  context?: string;
  fixed?: boolean;
}

function dashboardHref(role: AppRole | null): string {
  switch (role) {
    case "SUPERADMIN":   return "/admin";
    case "HOD":          return "/dashboard/hod";
    case "SENIOR_GUIDE": return "/dashboard";
    default:             return "/dashboard";
  }
}

const NAV_ITEMS: { key: NavKey; label: string; href: string; external?: boolean }[] = [
  { key: "home",          label: "Home",          href: "/" },
  { key: "training",      label: "Training",      href: "/training" },
  { key: "announcements", label: "Announcements", href: "/announcements" },
  { key: "about",         label: "About SFC",     href: "https://sfc.sarawak.gov.my/web/subpage/webpage_view/3", external: true },
];

export default function TopNavView({ active, authed, name, email, role, context, fixed = false }: TopNavViewProps) {
  const isPublic = !authed || role === "PUBLIC_USER";

  return (
    <div className={fixed ? "fixed top-0 left-0 w-full z-60" : "sticky top-0 z-60"}>
      {/* Gov-style top strip — flush to screen edges */}
      <div className="bg-primary text-white text-[11px] py-1.5 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="opacity-60 truncate">Portal Rasmi | Sarawak Forestry Corporation</span>
          <div className="flex items-center gap-4 opacity-60 shrink-0">
            <a href="#" className="hover:opacity-100">BM</a>
            <span>|</span>
            <a href="#" className="hover:opacity-100">EN</a>
          </div>
        </div>
      </div>

      {/* Main navbar */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
            {/* Brand + role context */}
            <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <span className="text-white text-lg">🌿</span>
              </div>
              <div className="leading-tight min-w-0">
                <div className="text-xs sm:text-sm font-extrabold text-primary tracking-tight truncate">Digital Sentinel</div>
                <div className="text-[10px] text-gray-500 font-medium hidden sm:block">Sarawak Forestry Corporation</div>
                {context && (
                  <div className="text-[10px] font-bold text-primary uppercase tracking-widest mt-0.5 truncate max-w-32 sm:max-w-56">
                    {context}
                  </div>
                )}
              </div>
            </Link>

            {/* Nav links */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map(({ key, label, href, external }) => {
                const isActive = key === active;
                const className = `px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? "text-primary bg-gray-100"
                    : "text-gray-600 hover:text-primary hover:bg-gray-50"
                }`;
                return external ? (
                  <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={className}>
                    {label}
                  </a>
                ) : (
                  <Link key={key} href={href} className={className}>
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Auth CTA */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {authed ? (
                <>
                  {isPublic ? (
                    <Link
                      href="/apply-guide"
                      className="flex items-center gap-1.5 bg-primary text-white px-3 sm:px-4 py-2 rounded-md text-sm font-semibold hover:bg-[#024a2f] transition-colors"
                    >
                      <span className="text-base leading-none">✦</span>
                      <span className="hidden sm:inline">Register as Guide</span>
                      <span className="sm:hidden">Register</span>
                    </Link>
                  ) : (
                    <>
                      <Link
                        href={dashboardHref(role)}
                        className="flex items-center gap-1.5 bg-primary text-white px-2.5 sm:px-4 py-2 rounded-md text-sm font-semibold hover:bg-[#024a2f] transition-colors"
                      >
                        <span className="material-symbols-outlined text-base leading-none">dashboard</span>
                        <span className="hidden sm:inline">Dashboard</span>
                      </Link>
                      <NotificationBell />
                    </>
                  )}
                  <ProfileDropdown name={name ?? ""} email={email ?? ""} />
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm font-medium text-gray-600 hover:text-primary px-2 sm:px-3 py-2 rounded-md transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="flex items-center gap-1.5 bg-primary text-white px-3 sm:px-4 py-2 rounded-md text-sm font-semibold hover:bg-[#024a2f] transition-colors"
                  >
                    <span className="text-base leading-none">✦</span>
                    <span className="hidden sm:inline">Register as Guide</span>
                    <span className="sm:hidden">Register</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}