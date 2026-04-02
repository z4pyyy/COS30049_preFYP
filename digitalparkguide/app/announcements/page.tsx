// A3.1 — Public Guardian Announcements page (unauthenticated)
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// A3.3 — SEO / Open Graph
export const metadata: Metadata = {
  title: "Announcements",
  description: "Official announcements and field reports from the Sarawak Biodiversity Unit.",
  openGraph: {
    title: "Guardian Announcements | SFC Digital Training",
    description: "Intelligence, field reports, and strategic updates from the Sarawak Biodiversity Unit.",
  },
};

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  published_at: string;
}

export default async function AnnouncementsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, content, category, published_at")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(20);

  const announcements = data as Announcement[] | null;

  // Split into featured (first) + rest
  const featured   = announcements?.[0]  ?? null;
  const sidebarItem= announcements?.[1]  ?? null;
  const gridItems  = announcements?.slice(2, 4) ?? [];

  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen">
      {/* ── Top Nav ── */}
      <nav className="sticky top-0 z-50 px-6 py-4 flex justify-between items-center w-full shadow-[0_20px_40px_rgba(25,28,29,0.06)]"
        style={{ background: "rgba(2,40,26,0.9)", backdropFilter: "blur(24px)" }}>
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-white">Digital Sentinel</span>
          <div className="hidden md:flex gap-6 items-center">
            <Link href="/training" className="tracking-tight text-emerald-100/70 hover:text-white transition-colors text-sm">Training</Link>
            <Link href="/training" className="tracking-tight text-emerald-100/70 hover:text-white transition-colors text-sm">Programmes</Link>
            <Link href="/dashboard" className="tracking-tight text-emerald-100/70 hover:text-white transition-colors text-sm">Dashboard</Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm">search</span>
            <input className="bg-white/10 border-none text-white text-sm rounded-full pl-10 pr-4 py-2 w-64 focus:ring-2 focus:ring-white/20 transition-all placeholder:text-white/40 outline-none" placeholder="Search system…" type="text" />
          </div>
          <Link href="/login" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full transition-all text-sm font-medium active:scale-95">
            <span className="material-symbols-outlined text-[18px]">login</span>
            Sign In
          </Link>
        </div>
      </nav>

      <main className="min-h-screen">
        {/* ── Hero ── */}
        <header className="relative h-[450px] flex items-end overflow-hidden bg-primary px-6 md:px-12 pb-16">
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background: "linear-gradient(rgba(1,45,29,0.2),rgba(1,45,29,0.2)), url('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600&q=80')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="relative z-10 max-w-4xl">
            <div className="inline-flex items-center gap-2 bg-tertiary-container/40 text-on-tertiary-container backdrop-blur-md px-3 py-1 rounded-full mb-6">
              <span className="material-symbols-outlined text-[14px]">sensors</span>
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase">Live Broadcast Portal</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-headline font-black text-white tracking-tighter leading-none mb-6">
              Guardian <br /><span className="text-primary-fixed-dim">Announcements</span>
            </h1>
            <p className="text-emerald-50/80 text-lg max-w-xl font-light leading-relaxed">
              Intelligence, field reports, and strategic updates from the Sarawak Biodiversity Unit.
            </p>
          </div>
          <div className="absolute right-0 bottom-0 p-12 hidden lg:block">
            <div className="bg-white/5 backdrop-blur-2xl p-6 rounded-xl border border-white/10 flex flex-col gap-4">
              <div className="flex gap-4 items-center">
                <div className="h-12 w-12 rounded-lg bg-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-white">shield_with_heart</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Patrol Status</p>
                  <p className="text-white font-bold">Active Units: 142</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ── Filter Bar ── */}
        <section className="bg-surface-container-low px-6 md:px-12 py-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-4 md:pb-0">
            {["All Updates", "Field Alerts", "Training News", "Strategic Ops"].map((label, i) => (
              <button
                key={label}
                className={`px-6 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  i === 0
                    ? "bg-primary text-white"
                    : "bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-secondary text-sm font-medium">
            <span className="material-symbols-outlined text-[18px]">sort</span>
            Sort by: Latest
          </div>
        </section>

        {/* ── Announcements Grid ── */}
        <section className="px-6 md:px-12 py-16 max-w-[1600px] mx-auto">
          {error && (
            <div className="bg-error-container text-on-error-container rounded-xl px-5 py-4 flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined">error</span>
              <span className="font-medium text-sm">Could not load announcements. Please try again later.</span>
            </div>
          )}

          {!error && !featured && (
            <div className="text-center py-24 text-secondary">
              <span className="material-symbols-outlined text-5xl mb-4 block text-outline">inbox</span>
              <p className="font-semibold text-lg">No announcements yet</p>
              <p className="text-sm mt-1">Check back soon for updates from SFC.</p>
            </div>
          )}

          {featured && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              {/* Featured */}
              <article className="md:col-span-8 group cursor-pointer">
                <div className="relative h-[500px] rounded-xl overflow-hidden mb-6">
                  <div className="w-full h-full bg-primary-container" />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-8">
                    <span className="bg-error text-white text-[10px] font-bold tracking-[0.2em] uppercase px-3 py-1 rounded-sm mb-4 inline-block">
                      {featured.category}
                    </span>
                    <h2 className="text-3xl md:text-5xl font-headline font-bold text-white tracking-tight mb-4">
                      {featured.title}
                    </h2>
                    <p className="text-emerald-50/70 text-lg max-w-2xl line-clamp-2">{featured.content}</p>
                  </div>
                </div>
              </article>

              {/* Sidebar */}
              {sidebarItem && (
                <article className="md:col-span-4 bg-surface-container-lowest p-8 rounded-xl flex flex-col justify-between border-l-4 border-error">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-error mb-4">{sidebarItem.category}</p>
                    <h3 className="text-2xl font-bold tracking-tight mb-4 text-primary leading-tight">{sidebarItem.title}</h3>
                    <p className="text-secondary mb-6 leading-relaxed line-clamp-4">{sidebarItem.content}</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-surface-container-high pt-6">
                    <span className="text-xs text-on-surface-variant font-medium">
                      {new Date(sidebarItem.published_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <a href="#" className="text-primary font-bold text-sm flex items-center gap-1 hover:gap-3 transition-all">
                      Read <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </a>
                  </div>
                </article>
              )}

              {/* Grid row */}
              {gridItems.map((item) => (
                <article key={item.id} className="md:col-span-4 bg-surface-container-low rounded-xl overflow-hidden group">
                  <div className="h-48 bg-primary-container/20" />
                  <div className="p-6">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-secondary-fixed-dim bg-secondary-container px-2 py-0.5 rounded">
                      {item.category}
                    </span>
                    <h3 className="text-xl font-bold text-primary mt-3 mb-2 leading-tight">{item.title}</h3>
                    <p className="text-on-surface-variant text-sm line-clamp-3">{item.content}</p>
                  </div>
                </article>
              ))}

              {/* CTA tile */}
              <article className="md:col-span-4 bg-primary text-white rounded-xl p-8 relative flex flex-col justify-center">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <span className="material-symbols-outlined text-[100px]">shield</span>
                </div>
                <h3 className="text-2xl font-bold mb-4 relative z-10">Institutional Links</h3>
                <p className="text-emerald-100/60 text-sm mb-6 relative z-10">Access restricted government documentation and multi-agency cooperation frameworks.</p>
                <button className="bg-white text-primary px-6 py-2 rounded-full font-bold text-sm w-fit active:scale-95 transition-transform relative z-10">
                  Explore Archive
                </button>
              </article>
            </div>
          )}
        </section>

        {/* ── Newsletter CTA ── */}
        <section className="bg-white py-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <span className="material-symbols-outlined text-error text-[48px] mb-4 block">mail</span>
            <h2 className="text-3xl font-headline font-black text-primary tracking-tight mb-4">Stay Synchronized</h2>
            <p className="text-secondary max-w-lg mx-auto mb-10">Subscribe to the Digital Sentinel Briefing for monthly intelligence on Sarawak&apos;s biodiversity progress.</p>
            <form className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
              <input className="flex-1 bg-surface-container border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 outline-none" placeholder="official@agency.gov" type="email" />
              <button className="bg-primary text-white font-bold px-8 py-3 rounded-xl hover:bg-primary/90 transition-colors active:scale-95" type="submit">Subscribe</button>
            </form>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-emerald-950 w-full py-12 mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center px-12 gap-8">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold text-white">Digital Sentinel</span>
            <p className="text-xs font-light tracking-wide text-emerald-100/50 max-w-[240px]">
              Official training and announcement portal for the Sarawak Forestry Corporation Biodiversity Unit.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {["Accessibility", "Privacy Policy", "Institutional Links", "Contact Sentinel"].map((l) => (
              <a key={l} href="#" className="text-xs font-light tracking-wide text-emerald-100 opacity-70 hover:opacity-100 hover:text-red-500 transition-colors">{l}</a>
            ))}
          </div>
          <p className="text-xs font-light tracking-wide text-emerald-100 opacity-50">© 2024 Sarawak Forestry Corporation. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
