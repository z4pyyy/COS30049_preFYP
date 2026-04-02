import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-primary">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-primary/60 z-10" />
        <img
          src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=1600&q=80"
          alt=""
          className="w-full h-full object-cover grayscale blur-sm scale-105"
        />
      </div>

      <div className="relative z-20 flex flex-col items-center text-center px-6 max-w-lg">
        {/* Code */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-px w-16 bg-white/30" />
          <span className="text-[0.625rem] uppercase tracking-[0.4em] text-white/50 font-bold">Access Denied</span>
          <div className="h-px w-16 bg-white/30" />
        </div>

        <div className="text-[10rem] font-black text-white/10 leading-none select-none -mb-8">
          401
        </div>

        <div className="w-20 h-20 bg-tertiary-container rounded-2xl flex items-center justify-center mb-8 shadow-2xl">
          <span className="material-symbols-outlined text-on-tertiary-container text-4xl"
            style={{ fontVariationSettings: "'FILL' 1" }}>
            lock
          </span>
        </div>

        <h1 className="text-4xl font-black text-white tracking-tight mb-4">
          Unauthorised Access
        </h1>
        <p className="text-white/60 text-base leading-relaxed mb-10">
          You do not have the required clearance to access this section of the Guardian Portal.
          Contact your HoD to request elevated access.
        </p>

        <div className="flex gap-4 flex-wrap justify-center">
          <Link
            href="/"
            className="flex items-center gap-2 bg-white text-primary font-bold px-6 py-3 rounded-xl hover:bg-primary-fixed transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            Back to Home
          </Link>
          {/* <Link
            href="/login"
            className="flex items-center gap-2 border border-white/20 text-white font-bold px-6 py-3 rounded-xl hover:bg-white/10 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">login</span>
            Sign In
          </Link> */}
        </div>

        <div className="mt-12 text-[0.625rem] font-mono text-white/30 uppercase tracking-widest">
          SFC Digital Sentinel · Guardian Portal · Error 401
        </div>
      </div>
    </main>
  );
}
