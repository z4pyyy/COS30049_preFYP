// Public landing page — SFC Sarawak style
// Server component: fetches latest announcements from Supabase
export const dynamic = 'force-dynamic'

import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import TopNav from "@/components/TopNav";

type Block =
  | { type: "h1" | "h2" | "h3" | "paragraph"; text: string }
  | { type: "attachment"; name: string; url: string; path: string; size: number; mime: string };

interface ListAnnouncement {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  blocks: Block[] | null;
}

async function getAnnouncements(): Promise<ListAnnouncement[]> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );
    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, content, category, created_at, blocks")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      console.error("Failed to fetch announcements:", error);
      return [];
    }
    return (data as ListAnnouncement[] | null) ?? [];
  } catch (err) {
    console.error("Error in getAnnouncements:", err);
    return [];
  }
}

// Remove "[filename.ext]" attachment markers and collapse blank lines
function stripAttachmentMarkers(text: string): string {
  return text
    .replace(/\[[^\[\]\n]+\.[a-zA-Z0-9]{1,5}\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstImage(blocks: Block[] | null): { url: string; name: string } | null {
  if (!Array.isArray(blocks)) return null;
  for (const b of blocks) {
    if (b.type === "attachment" && b.mime?.startsWith("image/")) {
      return { url: b.url, name: b.name };
    }
  }
  return null;
}

async function getAuthUser() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    return { user, role: profile?.role ?? null };
  } catch (err) {
    console.error("Error in getAuthUser:", err);
    return null;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "numeric", month: "short", year: "numeric",
  });
}

const CATEGORY_COLORS: Record<string, string> = {
  TRAINING:    "bg-blue-100 text-blue-800",
  POLICY:      "bg-amber-100 text-amber-800",
  OPERATIONS:  "bg-green-100 text-green-800",
  SAFETY:      "bg-red-100 text-red-800",
  GENERAL:     "bg-gray-100 text-gray-700",
};

const quickLinks = [
  { label: "Training Programmes",  href: "/training",  icon: "school" },
  { label: "Biodiversity Database", href: "/biodiversity", icon: "eco" },
  { label: "Incident Reports",      href: "/incidents",    icon: "warning" },
  { label: "E-Certification",       href: "/certifications", icon: "workspace_premium" },
];

const stats = [
  { value: "48", label: "Certified Guides" },
  { value: "12", label: "Protected Areas" },
  { value: "3", label: "Active Patrols" },
  { value: "99.4%", label: "Uptime SLA" },
];

export default async function HomePage() {
  const [announcements, authResult] = await Promise.all([getAnnouncements(), getAuthUser()]);
  const user = authResult?.user ?? null;
  const role = authResult?.role ?? null;
  const isPublic = user && role === 'PUBLIC';

  const featured = announcements[0];
  const rest = announcements.slice(1);
  const featuredImage = featured ? firstImage(featured.blocks) : null;

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-gray-900 font-sans">
      <TopNav active="home" />

      {/* ── Hero Banner ── */}
      <section className="relative bg-[#012d1d] text-white overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=1400&q=80"
            alt=""
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#012d1d]/90 via-[#012d1d]/60 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wider uppercase mb-6">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              System Online — Borneo Wildlife Conservation
            </div>
            <h1 className="text-4xl lg:text-6xl font-extrabold leading-tight tracking-tighter mb-6">
              Protecting Sarawak&apos;s<br />
              <span className="text-green-400">Natural Heritage</span>
            </h1>
            <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-xl">
              The Digital Sentinel platform supports SFC rangers, certified guides, and biodiversity
              officers in managing protected areas across Sarawak.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/announcements"
                className="bg-white text-[#012d1d] px-6 py-3 rounded-md font-semibold text-sm hover:bg-green-50 transition-colors"
              >
                Latest Announcements
              </Link>
              {(!user || isPublic) && (
                <Link
                  href={isPublic ? "/apply-guide" : "/register"}
                  className="border border-white/40 text-white px-6 py-3 rounded-md font-semibold text-sm hover:bg-white/10 transition-colors"
                >
                  {isPublic ? "Register as Guide →" : "Sign Up →"}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative border-t border-white/10 bg-black/20 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-extrabold text-green-400">{value}</div>
                <div className="text-xs text-white/50 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Main Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: Announcements ──────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#012d1d] flex items-center gap-2">
              <span className="w-1 h-5 bg-[#012d1d] rounded-full inline-block" />
              Latest Announcements
            </h2>
            <Link href="/announcements" className="text-xs text-[#012d1d] font-semibold hover:underline">
              View All →
            </Link>
          </div>

          {announcements.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium">No announcements yet.</p>
              <p className="text-sm mt-1">Check back soon for updates from SFC.</p>
            </div>
          ) : (
            <>
              {/* Featured announcement */}
              {featured && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="h-2 bg-[#012d1d]" />
                  {featuredImage && (
                    <Link href={`/announcements/${featured.id}`} className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={featuredImage.url}
                        alt={featuredImage.name}
                        className="w-full max-h-72 object-cover"
                      />
                    </Link>
                  )}
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${CATEGORY_COLORS[featured.category ?? "GENERAL"] ?? CATEGORY_COLORS["GENERAL"]}`}>
                        {featured.category ?? "General"}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(featured.created_at)}</span>
                      <span className="ml-auto text-[10px] bg-[#012d1d] text-white px-2 py-0.5 rounded-full font-bold">LATEST</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 leading-snug mb-3">{featured.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{stripAttachmentMarkers(featured.content)}</p>
                    <Link
                      href={`/announcements/${featured.id}`}
                      className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-[#012d1d] hover:underline"
                    >
                      Read more →
                    </Link>
                  </div>
                </div>
              )}

              {/* Rest of announcements */}
              <div className="grid sm:grid-cols-2 gap-4">
                {rest.map((a) => {
                  const img = firstImage(a.blocks);
                  return (
                    <Link
                      key={a.id}
                      href={`/announcements/${a.id}`}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-[#012d1d]/20 transition-all group"
                    >
                      {img && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={img.url}
                          alt={img.name}
                          className="w-full h-32 object-cover"
                        />
                      )}
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${CATEGORY_COLORS[a.category ?? "GENERAL"] ?? CATEGORY_COLORS["GENERAL"]}`}>
                            {a.category ?? "General"}
                          </span>
                          <span className="text-xs text-gray-400 ml-auto">{formatDate(a.created_at)}</span>
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-[#012d1d] transition-colors">
                          {a.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{stripAttachmentMarkers(a.content)}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Right: Sidebar ──────────────────────────────────── */}
        <div className="space-y-6">

          {/* Register / Sign Up CTA */}
          {(!user || isPublic) && (
            <div className="bg-[#012d1d] rounded-xl p-6 text-white relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/5" />
              <div className="absolute -right-2 -bottom-4 w-16 h-16 rounded-full bg-white/5" />
              <p className="text-[10px] uppercase tracking-widest text-green-400 font-bold mb-2">Certification Programme</p>
              <h3 className="text-lg font-bold leading-snug mb-3">Become a Certified Guide</h3>
              <p className="text-xs text-white/60 leading-relaxed mb-5">
                Complete SFC&apos;s accredited training to lead groups through Sarawak&apos;s protected forest areas.
              </p>
              <Link
                href={isPublic ? "/apply-guide" : "/register"}
                className="block text-center bg-white text-[#012d1d] text-sm font-bold px-4 py-3 rounded-lg hover:bg-green-50 transition-colors"
              >
                {isPublic ? "Register as Guide →" : "Sign Up →"}
              </Link>
            </div>
          )}

          {/* Quick Links */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-[#012d1d] rounded-full inline-block" />
              Quick Links
            </h3>
            <div className="space-y-1">
              {quickLinks.map(({ label, href, icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 group transition-colors"
                >
                  <span className="material-symbols-outlined text-[#012d1d] text-lg opacity-70 group-hover:opacity-100">
                    {icon}
                  </span>
                  <span className="text-sm text-gray-700 group-hover:text-[#012d1d] font-medium">{label}</span>
                  <span className="ml-auto text-gray-300 group-hover:text-[#012d1d] text-xs">→</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Emergency / Contact */}
          <div className="bg-red-50 border border-red-100 rounded-xl p-5">
            <h3 className="text-sm font-bold text-red-800 mb-1">Emergency Contact</h3>
            <p className="text-xs text-red-700/70 mb-3">For wildlife emergencies or poaching incidents:</p>
            <a href="tel:+6082610088" className="flex items-center gap-2 text-red-700 font-bold text-sm hover:underline">
              <span className="material-symbols-outlined text-lg">call</span>
              +60 82-610088
            </a>
            <p className="text-[10px] text-red-700/50 mt-2">SFC Operations Centre · 24 Hours</p>
          </div>

          {/* Sign in prompt for unauthenticated */}
          {!user && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
              <p className="text-sm font-semibold text-gray-700 mb-1">Already have an account?</p>
              <p className="text-xs text-gray-500 mb-4">Sign in to access your dashboard and training records.</p>
              <Link
                href="/login"
                className="block bg-[#012d1d] text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-[#024a2f] transition-colors"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="bg-[#012d1d] text-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-lg">🌿</div>
              <div>
                <div className="text-sm font-bold">Digital Sentinel</div>
                <div className="text-[10px] text-white/40">Sarawak Forestry Corporation</div>
              </div>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Supporting the management of protected areas, biodiversity conservation,
              and guide certification across Sarawak.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Platform</h4>
            <div className="space-y-2">
              {["Training Programmes", "Biodiversity Database", "E-Certifications", "Announcements"].map((l) => (
                <a key={l} href="#" className="block text-sm text-white/60 hover:text-white transition-colors">{l}</a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Organisation</h4>
            <div className="space-y-2">
              {["About SFC", "Contact Us", "Privacy Policy", "Accessibility"].map((l) => (
                <a key={l} href="#" className="block text-sm text-white/60 hover:text-white transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-[11px] text-white/30">
          © {new Date().getFullYear()} Sarawak Forestry Corporation · Jabatan Hutan Sarawak · All Rights Reserved
        </div>
      </footer>
    </div>
  );
}
