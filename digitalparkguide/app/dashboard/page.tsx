"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Data ──────────────────────────────────────────────────────────────────

const desktopStats = [
  { label: "Assigned Guides", value: "12" },
  { label: "Active Modules", value: "8" },
  { label: "Average Completion Rate", value: "88%" },
  { label: "Upcoming Sessions", value: "4" },
];

const mobileStats = [
  { label: "Assigned Guides", value: "24", badge: null, sub: null },
  { label: "Active Modules", value: "8", badge: null, sub: null },
  { label: "Avg Completion", value: "82%", badge: "On track", sub: null },
  { label: "Upcoming Sessions", value: "3", badge: null, sub: "Next 7 days" },
];

const moduleProgress = [
  { name: "Plants Basics", pct: 76 },
  { name: "Wildlife Safety", pct: 64 },
  { name: "Trail Etiquette", pct: 52 },
  { name: "Emergency Response", pct: 40 },
];

const guideStatus = [
  { label: "On Track", value: 18 },
  { label: "Behind", value: 5 },
  { label: "Inactive", value: 1 },
];

const guideBarData = [
  { label: "Guide A", pct: 85 },
  { label: "Guide B", pct: 55 },
  { label: "Guide C", pct: 72 },
  { label: "Guide D", pct: 90 },
  { label: "Guide E", pct: 65 },
];

const trainingModules = [
  {
    name: "Plants Identification",
    category: "Plants",
    enrolled: 12,
    status: "Active",
    next: "Jan 15, 2024",
  },
  {
    name: "Wildlife Behavior",
    category: "Wildlife",
    enrolled: 10,
    status: "Active",
    next: "Jan 22, 2024",
  },
];

const desktopSessions = [
  { date: "Jan 15, 2024", module: "Plants Identification", park: "Bako National Park", enrolled: 12, status: "Scheduled" },
  { date: "Jan 20, 2024", module: "Wildlife Behavior", park: "Mulu National Park", enrolled: 10, status: "Scheduled" },
  { date: "Jan 25, 2024", module: "Trail Safety", park: "Similajau National Park", enrolled: 11, status: "Canceled" },
  { date: "Jan 10, 2024", module: "Emergency Response", park: "Kubah National Park", enrolled: 12, status: "Completed" },
];

const mobileSessions = [
  { title: "Plants Basics – Session 3", location: "Bako National Park", date: "19 Mar, 10:00 AM", status: "Scheduled" },
  { title: "Plants Basics – Session 3", location: "Bako National Park", date: "19 Mar, 10:00 AM", status: "Completed" },
];

const quickActions = ["Create New Session", "Assign Guides", "Open Training Modules", "View AI Alerts"];

// ─── Sub-components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: "bg-[#5B9A3E] text-white",
    Scheduled: "bg-[#F0A500] text-white",
    Canceled: "bg-red-500 text-white",
    Completed: "bg-[#1B3A24] text-white",
    "On track": "bg-[#8DC63F] text-[#1B3A24]",
  };
  return (
    <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${map[status] ?? "bg-gray-200 text-gray-700"}`}>
      {status}
    </span>
  );
}

function Logo({ size = 36 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, padding: 3, borderRadius: 6, background: "#f5f0e6", border: "1px solid #d4c9b0", flexShrink: 0 }}
    >
      <div style={{ background: "#F0A500", borderRadius: 2 }} />
      <div style={{ background: "#1B3A24", borderRadius: 2 }} />
      <div style={{ background: "#2D6A3F", borderRadius: 2 }} />
      <div style={{ background: "#F0A500", borderRadius: 2 }} />
    </div>
  );
}

function GuideBarChart() {
  const chartH = 110;
  const barW = 30;
  const gap = 18;
  const leftPad = 32;
  const svgW = leftPad + guideBarData.length * (barW + gap);

  return (
    <svg width="100%" viewBox={`0 0 ${svgW} ${chartH + 28}`} preserveAspectRatio="xMidYMid meet">
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = chartH - (tick / 100) * chartH;
        return (
          <g key={tick}>
            <line x1={leftPad} y1={y} x2={svgW} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={leftPad - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
              {tick}%
            </text>
          </g>
        );
      })}
      {guideBarData.map((g, i) => {
        const barH = (g.pct / 100) * chartH;
        const x = leftPad + i * (barW + gap);
        const y = chartH - barH;
        return (
          <g key={g.label}>
            <rect x={x} y={y} width={barW} height={barH} rx={4} fill="#4a7c3f" />
            <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" fontSize={9} fill="#6b7280">
              {g.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────

const icons = {
  bell: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  dashboard: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  guides: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
    </svg>
  ),
  training: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  assess: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  alert: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  notif: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  more: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01" />
    </svg>
  ),
  search: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  user: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  chevron: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  ),
};

const sidebarNav = [
  { label: "Dashboard", icon: icons.dashboard },
  { label: "My Guides", icon: icons.guides },
  { label: "My Training Modules", icon: icons.training },
  { label: "Assessments", icon: icons.assess },
  { label: "AI Alerts", icon: icons.alert },
  { label: "Notifications", icon: icons.notif },
];

const bottomNav = [
  { label: "Dashboard", icon: icons.dashboard },
  { label: "My Guides", icon: icons.guides },
  { label: "Training", icon: icons.training },
  { label: "Assessments", icon: icons.assess },
  { label: "More", icon: icons.more },
];

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function MentorDashboard() {
  const [activeNav, setActiveNav] = useState("Dashboard");

  return (
    <div className="min-h-screen bg-[#F7F2E8] font-sans text-gray-900">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-52 flex-col bg-[#EEF5E0] border-r border-green-100">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-green-100">
          <Logo size={34} />
          <div className="leading-none">
            <p className="text-[9px] font-bold text-[#2D6A3F] uppercase tracking-wide">Sarawak</p>
            <p className="text-[9px] font-bold text-[#2D6A3F] uppercase tracking-wide">Forestry</p>
          </div>
        </div>
        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {sidebarNav.map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveNav(item.label)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left ${
                activeNav === item.label
                  ? "bg-[#1B3A24] text-white"
                  : "text-[#2D5A3D] hover:bg-green-100"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Desktop Top Bar ── */}
      <header className="hidden lg:flex fixed top-0 left-52 right-0 z-20 h-14 bg-[#F7F2E8] border-b border-[#e0d9cc] items-center px-6 gap-4">
        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 w-56 text-sm text-gray-400">
          {icons.search}
          <span>Search</span>
        </div>
        <div className="flex-1" />
        {/* Bell */}
        <button className="relative text-gray-500 hover:text-gray-700">
          {icons.bell}
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
        </button>
        {/* Avatar */}
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
          <div className="h-8 w-8 rounded-full bg-[#1B3A24] text-white flex items-center justify-center text-xs font-bold">
            MU
          </div>
          Mentor User
          {icons.chevron}
        </div>
      </header>

      {/* ── Mobile Header ── */}
      <header className="lg:hidden sticky top-0 z-20 bg-[#EEF5E0] border-b border-green-100 px-4 pt-3 pb-3">
        <div className="flex items-center justify-between">
          {/* Left: logo + title */}
          <div className="flex items-center gap-2.5">
            <Logo size={36} />
            <div className="leading-tight">
              <p className="text-[9px] font-bold text-[#2D6A3F] uppercase tracking-wide">Sarawak Forestry</p>
              <h1 className="text-base font-bold text-[#1B3A24]">Mentor Dashboard</h1>
              <p className="text-xs text-gray-500">Good afternoon, Jane</p>
            </div>
          </div>
          {/* Right: bell + avatar */}
          <div className="flex items-center gap-3">
            <button className="relative text-[#1B3A24]">
              {icons.bell}
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <div className="h-9 w-9 rounded-full bg-[#1B3A24] text-white flex items-center justify-center text-xs font-bold">
              JN
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="lg:ml-52 lg:pt-14 pb-24 lg:pb-8">

        {/* ====== DESKTOP LAYOUT ====== */}
        <div className="hidden lg:block px-8 py-6 space-y-6">

          {/* Page title + actions */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Mentor Dashboard</h1>
            <div className="flex gap-3">
              <button className="rounded-lg bg-[#F0A500] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-500 transition-colors">
                Create New Session
              </button>
              <button className="rounded-lg bg-[#1B3A24] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#2D5A3D] transition-colors">
                Assign Guides
              </button>
            </div>
          </div>

          {/* Stat cards (4 cols) */}
          <div className="grid grid-cols-4 gap-4">
            {desktopStats.map((s) => (
              <div key={s.label} className="rounded-xl bg-[#1B3A24] text-white px-5 py-4 shadow-sm">
                <p className="text-xs text-green-200 font-medium">{s.label}</p>
                <p className="mt-1.5 text-3xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Middle row: training modules table + guide progress chart */}
          <div className="grid grid-cols-5 gap-4">
            {/* Training Modules (wider) */}
            <div className="col-span-3 rounded-xl bg-[#1B3A24] text-white overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-white/10">
                <h2 className="font-semibold text-sm">My Training Modules</h2>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-green-200">
                    <th className="px-5 py-2.5 text-left font-medium">Module Name</th>
                    <th className="px-3 py-2.5 text-left font-medium">Category</th>
                    <th className="px-3 py-2.5 text-center font-medium">Enrolled Guides</th>
                    <th className="px-3 py-2.5 text-center font-medium">Status</th>
                    <th className="px-5 py-2.5 text-left font-medium">Next Session Date</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingModules.map((m, i) => (
                    <tr key={i} className="border-t border-white/10 hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3 font-medium">{m.name}</td>
                      <td className="px-3 py-3 text-green-100">{m.category}</td>
                      <td className="px-3 py-3 text-center">{m.enrolled}</td>
                      <td className="px-3 py-3 text-center">
                        <StatusBadge status={m.status} />
                      </td>
                      <td className="px-5 py-3 text-green-100">{m.next}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Guide Progress chart */}
            <div className="col-span-2 rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-sm text-gray-800">Guide Progress</h2>
              </div>
              <div className="px-4 py-3">
                <GuideBarChart />
              </div>
            </div>
          </div>

          {/* Upcoming Sessions table */}
          <div className="rounded-xl bg-[#1B3A24] text-white overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-white/10">
              <h2 className="font-semibold text-sm">Upcoming Sessions</h2>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-green-200">
                  <th className="px-5 py-2.5 text-left font-medium">Session Date</th>
                  <th className="px-5 py-2.5 text-left font-medium">Module Name</th>
                  <th className="px-5 py-2.5 text-left font-medium">Park</th>
                  <th className="px-5 py-2.5 text-center font-medium">Guides Enrolled</th>
                  <th className="px-5 py-2.5 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {desktopSessions.map((s, i) => (
                  <tr key={i} className="border-t border-white/10 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3">{s.date}</td>
                    <td className="px-5 py-3 font-medium">{s.module}</td>
                    <td className="px-5 py-3 text-green-100">{s.park}</td>
                    <td className="px-5 py-3 text-center">{s.enrolled}</td>
                    <td className="px-5 py-3 text-center">
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ====== MOBILE LAYOUT ====== */}
        <div className="lg:hidden px-4 py-4 space-y-4">

          {/* Stat cards 2×2 grid */}
          <div className="grid grid-cols-2 gap-3">
            {mobileStats.map((s, i) => (
              <div key={i} className="rounded-2xl bg-[#1B3A24] text-white px-4 py-3.5 shadow-sm">
                <p className="text-xs text-green-200">{s.label}</p>
                <div className="mt-1 flex items-end gap-2">
                  <p className="text-3xl font-bold leading-none">{s.value}</p>
                  {s.badge && <StatusBadge status={s.badge} />}
                </div>
                {s.sub && <p className="mt-1 text-xs text-green-300">{s.sub}</p>}
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-2">Quick Actions</h2>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {quickActions.map((a) => (
                <button
                  key={a}
                  className="flex-shrink-0 rounded-full border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Module Progress */}
          <div className="rounded-2xl bg-[#1B3A24] text-white px-5 py-4 shadow-sm">
            <h2 className="font-semibold text-sm mb-4">Module Progress</h2>
            <div className="space-y-3">
              {moduleProgress.map((m) => (
                <div key={m.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-green-100">{m.name}</span>
                    <span className="font-semibold">{m.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#8DC63F] transition-all"
                      style={{ width: `${m.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Guide Status */}
          <div className="rounded-2xl bg-[#1B3A24] text-white px-5 py-4 shadow-sm">
            <h2 className="font-semibold text-sm mb-4">Guide Status</h2>
            <div className="flex justify-around text-center">
              {guideStatus.map((g) => (
                <div key={g.label}>
                  <p className="text-xs text-green-200">{g.label}</p>
                  <p className="text-3xl font-bold mt-1">{g.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Sessions */}
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-2">Upcoming Sessions</h2>
            <div className="space-y-3">
              {mobileSessions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.location} &bull; {s.date}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 flex">
        {bottomNav.map((item) => (
          <button
            key={item.label}
            onClick={() => setActiveNav(item.label)}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
              activeNav === item.label ? "text-[#1B3A24]" : "text-gray-400"
            }`}
          >
            <span className={`p-1 rounded-lg ${activeNav === item.label ? "bg-[#EEF5E0]" : ""}`}>
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
