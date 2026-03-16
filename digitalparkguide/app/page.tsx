import Link from "next/link";

const features = [
  {
    icon: "🗺️",
    title: "Interactive Maps",
    desc: "Navigate every trail, facility, and attraction with live maps tailored to your visit.",
  },
  {
    icon: "📅",
    title: "Event Calendar",
    desc: "Stay up-to-date with park events, guided tours, and seasonal highlights.",
  },
  {
    icon: "🌿",
    title: "Flora & Fauna",
    desc: "Discover the park's biodiversity with our rich species database and AR identifiers.",
  },
  {
    icon: "♿",
    title: "Accessibility Info",
    desc: "Find wheelchair-friendly paths, rest zones, and accessible facilities instantly.",
  },
  {
    icon: "🔔",
    title: "Smart Alerts",
    desc: "Receive real-time notifications about trail closures, weather, and safety updates.",
  },
  {
    icon: "📸",
    title: "Photo Spots",
    desc: "Discover the best photography locations and share your moments with the community.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🌳</span>
            <span className="text-lg font-bold tracking-tight text-green-700">
              DigitalParkGuide
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-gray-600 md:flex">
            <a href="#features" className="hover:text-green-700 transition-colors">
              Features
            </a>
            <a href="#about" className="hover:text-green-700 transition-colors">
              About
            </a>
            <a href="#contact" className="hover:text-green-700 transition-colors">
              Contact
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full border border-green-700 px-4 py-1.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-50"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-green-700 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-800"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-green-50 via-white to-emerald-50 px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
        {/* Background blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-green-200 opacity-30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-emerald-200 opacity-30 blur-3xl"
        />

        <div className="relative mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-green-100 px-4 py-1 text-sm font-semibold text-green-800">
            Your Smart Park Companion
          </span>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Explore the Park
            <span className="block text-green-700">Like Never Before</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-gray-600 sm:text-lg">
            DigitalParkGuide brings interactive maps, real-time alerts, and rich
            nature information to your fingertips — whether you&apos;re a weekend
            visitor or a daily regular.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="w-full rounded-full bg-green-700 px-7 py-3 text-center text-sm font-semibold text-white shadow-md transition-all hover:bg-green-800 hover:shadow-lg sm:w-auto"
            >
              Start Exploring →
            </Link>
            <Link
              href="/dashboard"
              className="w-full rounded-full border border-gray-300 px-7 py-3 text-center text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
            >
              View Dashboard Demo
            </Link>
          </div>
          {/* Trust badges */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
            <span>✅ Free to use</span>
            <span>✅ No download required</span>
            <span>✅ Works on any device</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Everything you need in the park
            </h2>
            <p className="mt-3 text-gray-500">
              Packed with features to make every park visit safer, smarter, and
              more enjoyable.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-2xl">
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold text-gray-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About / CTA Banner */}
      <section
        id="about"
        className="mx-4 my-8 overflow-hidden rounded-3xl bg-green-700 px-6 py-14 text-center text-white sm:mx-6 sm:px-10 lg:mx-auto lg:max-w-6xl"
      >
        <h2 className="text-2xl font-bold sm:text-3xl">
          Built for every park-goer
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm text-green-100 sm:text-base">
          Whether you&apos;re a family on a weekend outing, a jogger on your daily
          route, or a nature enthusiast documenting wildlife — DigitalParkGuide
          adapts to you.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-full bg-white px-8 py-3 text-sm font-semibold text-green-800 shadow transition-all hover:bg-green-50 hover:shadow-md"
        >
          Create a free account
        </Link>
      </section>

      {/* Footer */}
      <footer
        id="contact"
        className="border-t border-gray-100 px-4 py-8 text-center text-sm text-gray-400 sm:px-6 lg:px-8"
      >
        <p>
          &copy; {new Date().getFullYear()} DigitalParkGuide &mdash; Swinburne
          University of Technology
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-4">
          <a href="#" className="hover:text-green-700 transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-green-700 transition-colors">
            Terms of Use
          </a>
          <a href="mailto:hello@digitalparkguide.app" className="hover:text-green-700 transition-colors">
            Contact
          </a>
        </div>
      </footer>
    </div>
  );
}
