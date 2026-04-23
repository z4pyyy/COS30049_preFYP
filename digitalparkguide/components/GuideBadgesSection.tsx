"use client"

import { useState } from "react"
import type { BadgeRecord } from "@/lib/badges/insert-badge"

interface Props {
  badges: BadgeRecord[]
  loading: boolean
}

function isExpiringSoon(renewalDue: string): boolean {
  const msInDay = 1000 * 60 * 60 * 24
  return (new Date(renewalDue).getTime() - Date.now()) / msInDay <= 60
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function BadgeCard({ badge, dimmed = false }: { badge: BadgeRecord; dimmed?: boolean }) {
  const expiringSoon = badge.status === "active" && isExpiringSoon(badge.renewal_due_at)

  const pill =
    badge.status === "active"
      ? expiringSoon
        ? { label: "Expiring Soon", cls: "bg-amber-100 text-amber-800" }
        : { label: "Active",        cls: "bg-emerald-100 text-emerald-800" }
      : badge.status === "expired"
      ? { label: "Expired",  cls: "bg-red-100 text-red-700" }
      : { label: "Revoked",  cls: "bg-gray-100 text-gray-500" }

  const borderCls =
    badge.status === "active"
      ? expiringSoon
        ? "border-amber-400"
        : "border-[#2D6A3F]"
      : badge.status === "expired"
      ? "border-red-300"
      : "border-gray-300"

  return (
    <div
      className={`bg-surface-container-low p-6 rounded-xl space-y-3 border-l-4 ${borderCls} transition-opacity ${
        dimmed ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant truncate">
            {badge.park_name}
          </p>
          <h3 className="text-lg font-black text-primary leading-tight">{badge.track_name}</h3>
        </div>
        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${pill.cls}`}>
          {pill.label}
        </span>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <span className="font-semibold text-on-surface-variant">Issued</span>
        <span className="text-on-surface-variant">{formatDate(badge.issued_at)}</span>

        <span className={`font-semibold ${expiringSoon ? "text-amber-700" : "text-on-surface-variant"}`}>
          Renewal Due
        </span>
        <span className={expiringSoon ? "text-amber-700 font-semibold" : "text-on-surface-variant"}>
          {formatDate(badge.renewal_due_at)}
        </span>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-surface-container-low p-6 rounded-xl border-l-4 border-gray-200 animate-pulse space-y-3">
      <div className="space-y-1.5">
        <div className="h-2.5 w-1/3 rounded bg-gray-200" />
        <div className="h-5 w-2/3 rounded bg-gray-200" />
      </div>
      <div className="space-y-1.5">
        <div className="h-2.5 w-full rounded bg-gray-200" />
        <div className="h-2.5 w-full rounded bg-gray-200" />
      </div>
    </div>
  )
}

export function GuideBadgesSection({ badges, loading }: Props) {
  const [showAll, setShowAll] = useState(false)

  const active   = badges.filter((b) => b.status === "active")
  const inactive = badges.filter((b) => b.status !== "active")

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-primary">My Certifications</h2>
        {!loading && inactive.length > 0 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="flex items-center gap-0.5 text-sm font-semibold text-primary hover:underline"
          >
            {showAll ? "Show active only" : `Show all (${badges.length})`}
            <span className="material-symbols-outlined text-base leading-none">
              {showAll ? "expand_less" : "expand_more"}
            </span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : active.length === 0 && !showAll ? (
        <div className="bg-surface-container-low p-6 rounded-xl border-l-4 border-gray-200">
          <p className="text-sm text-on-surface-variant">
            No active certifications yet.{" "}
            <a href="/training/tracks" className="font-semibold text-primary hover:underline">
              Browse training tracks
            </a>{" "}
            to earn your first badge.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {active.map((b) => (
            <BadgeCard key={b.id} badge={b} />
          ))}
          {showAll &&
            inactive.map((b) => (
              <BadgeCard key={b.id} badge={b} dimmed />
            ))}
        </div>
      )}
    </section>
  )
}
