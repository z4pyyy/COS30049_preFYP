"use client";

// Full-page loading screen — drop-in replacement for blank white while data loads.
// Usage: if (loading) return <PageLoader />
//        or: if (loading) return <PageLoader message="Loading application…" />

export function PageLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-[#f5f5f0] flex flex-col items-center justify-center gap-5">
      {/* Logo */}
      <div className="relative">
        <div className="w-16 h-16 bg-[#012d1d] rounded-2xl flex items-center justify-center shadow-lg">
          <span className="text-3xl select-none">🌿</span>
        </div>
        {/* Ring spinner around logo */}
        <div className="absolute -inset-2 rounded-[1.25rem] border-4 border-[#012d1d]/10 border-t-[#012d1d] animate-spin" />
      </div>

      {/* Text */}
      <div className="text-center space-y-1">
        <p className="text-sm font-bold text-[#012d1d] tracking-tight">
          {message ?? "Loading…"}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
          Sarawak Forestry Corporation
        </p>
      </div>

      {/* Dot pulse */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#012d1d]/30 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// Inline variant — for sections within a page, not full screen
export function SectionLoader({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 border-4 border-[#012d1d]/10 border-t-[#012d1d] rounded-full animate-spin" />
      <p className="text-sm font-semibold text-gray-500">{message ?? "Loading…"}</p>
    </div>
  );
}
