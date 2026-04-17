'use client'

export default function BackToSiteButton() {
  return (
    <a
      href="/"
      className="w-full flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-100 rounded-xl transition-all text-sm"
    >
      <span className="material-symbols-outlined text-base">arrow_back</span>
      <span className="font-medium text-[0.6875rem] uppercase tracking-widest">Back to Site</span>
    </a>
  )
}
