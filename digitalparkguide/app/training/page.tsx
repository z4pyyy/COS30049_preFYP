// A3.2 — Public training programme brief listing (unauthenticated)
// Displays available Guide and Ranger training tracks per TPA
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// A3.3 — SEO metadata
export const metadata: Metadata = {
  title: "Training Programmes",
  description:
    "Browse available Guide and Ranger training tracks offered by Sarawak Forestry Corporation across Totally Protected Areas.",
  openGraph: {
    title: "SFC Training Programmes",
    description:
      "Explore forestry training tracks, eligibility requirements, and certification paths for Guides and Rangers.",
  },
};

interface TrainingTrack {
  id: string;
  title: string;
  track_type: "GUIDE" | "RANGER" | "SENIOR_GUIDE";
  tpa_name: string;
  overview: string;
  duration_weeks: number;
  eligibility: string;
  is_open: boolean;
}

const TRACK_BADGE: Record<string, { bg: string; text: string; icon: string }> = {
  GUIDE:        { bg: "bg-primary-fixed",   text: "text-on-primary-fixed",   icon: "hiking"         },
  SENIOR_GUIDE: { bg: "bg-secondary-container", text: "text-on-secondary-container", icon: "military_tech" },
  RANGER:       { bg: "bg-tertiary-fixed",  text: "text-on-tertiary-fixed",  icon: "shield_person"  },
};

export default async function TrainingPage() {
  const supabase = await createClient();

  const { data: tracks, error } = await supabase
    .from("training_tracks")
    .select("id, title, track_type, tpa_name, overview, duration_weeks, eligibility, is_open")
    .order("track_type")
    .order("tpa_name");

  // Group by TPA
  const byTpa = (tracks as TrainingTrack[] | null)?.reduce<Record<string, TrainingTrack[]>>(
    (acc, t) => {
      (acc[t.tpa_name] ??= []).push(t);
      return acc;
    },
    {}
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary-fixed text-2xl">forest</span>
          <span className="font-black tracking-tighter uppercase text-sm">SFC Digital Training</span>
        </div>
        <nav className="flex items-center gap-4 text-sm font-semibold">
          <Link href="/announcements" className="text-on-primary-container hover:text-white transition-colors">
            Announcements
          </Link>
          <Link
            href="/login"
            className="bg-primary-fixed text-primary px-4 py-2 rounded-full text-xs font-bold hover:bg-white transition-colors"
          >
            Sign In
          </Link>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">school</span>
            </div>
            <h1 className="text-on-surface text-3xl font-black tracking-tight">Training Programmes</h1>
          </div>
          <p className="text-secondary font-medium max-w-xl">
            Explore available Guide and Ranger training tracks across Totally Protected Areas.
            Sign in to enrol or track your progress.
          </p>

          {/* Track type legend */}
          <div className="flex gap-3 mt-6 flex-wrap">
            {Object.entries(TRACK_BADGE).map(([type, { bg, text, icon }]) => (
              <div key={type} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${bg} ${text}`}>
                <span className="material-symbols-outlined text-sm">{icon}</span>
                {type.replace("_", " ")}
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-error-container text-on-error-container rounded-xl px-5 py-4 flex items-center gap-3 mb-8">
            <span className="material-symbols-outlined">error</span>
            <span className="font-medium text-sm">Could not load training programmes. Please try again later.</span>
          </div>
        )}

        {/* Empty */}
        {!error && (!byTpa || Object.keys(byTpa).length === 0) && (
          <div className="text-center py-24 text-secondary">
            <span className="material-symbols-outlined text-5xl mb-4 block text-outline">menu_book</span>
            <p className="font-semibold text-lg">No training programmes available yet</p>
            <p className="text-sm mt-1">Check back soon.</p>
          </div>
        )}

        {/* Grouped by TPA */}
        {byTpa && Object.entries(byTpa).map(([tpa, tpaTracks]) => (
          <section key={tpa} className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <span className="material-symbols-outlined text-primary">location_on</span>
              <h2 className="text-on-surface text-xl font-black">{tpa}</h2>
              <div className="flex-1 h-px bg-outline-variant ml-2" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {tpaTracks.map((track) => {
                const badge = TRACK_BADGE[track.track_type] ?? TRACK_BADGE.GUIDE;
                return (
                  <div
                    key={track.id}
                    className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
                        <span className="material-symbols-outlined text-sm">{badge.icon}</span>
                        {track.track_type.replace("_", " ")}
                      </div>
                      {track.is_open ? (
                        <span className="text-xs font-bold text-primary bg-primary-fixed/40 px-2 py-1 rounded-full">
                          Open
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-outline bg-surface-container px-2 py-1 rounded-full">
                          Closed
                        </span>
                      )}
                    </div>

                    <h3 className="text-on-surface font-bold text-base mb-2 leading-snug">{track.title}</h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed mb-4 line-clamp-3">{track.overview}</p>

                    <div className="space-y-1.5 text-xs text-secondary">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">schedule</span>
                        {track.duration_weeks} week{track.duration_weeks !== 1 ? "s" : ""}
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-sm mt-0.5">checklist</span>
                        <span>{track.eligibility}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* CTA */}
        <div className="mt-10 bg-primary rounded-2xl p-8 text-white text-center">
          <span className="material-symbols-outlined text-primary-fixed text-4xl mb-3 block">rocket_launch</span>
          <h2 className="text-2xl font-black mb-2">Ready to Enrol?</h2>
          <p className="text-on-primary-container font-medium mb-6 max-w-sm mx-auto">
            Sign in with your SFC credentials to start a training track, track your progress, and earn certifications.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-primary-fixed text-primary font-bold px-6 py-3 rounded-xl hover:bg-white transition-colors"
          >
            Sign In to Enrol
            <span className="material-symbols-outlined text-xl">arrow_forward</span>
          </Link>
        </div>
      </main>

      <footer className="border-t border-outline-variant mt-16 py-8 text-center text-xs text-outline space-y-1">
        <p className="font-bold uppercase tracking-widest">© 2024 Sarawak Forestry Corporation</p>
        <div className="flex justify-center gap-6">
          {["Privacy", "Terms", "Contact"].map((l) => (
            <a key={l} href="#" className="hover:text-primary transition-colors">{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
