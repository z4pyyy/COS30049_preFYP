"use client";

import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastData {
  msg: string;
  type: ToastType;
}

const CONFIG: Record<ToastType, { bg: string; icon: string; bar: string }> = {
  success: { bg: "bg-[#012d1d]",    icon: "check_circle", bar: "bg-green-400" },
  error:   { bg: "bg-red-700",      icon: "error",        bar: "bg-red-300"   },
  warning: { bg: "bg-amber-600",    icon: "warning",      bar: "bg-amber-300" },
  info:    { bg: "bg-slate-700",    icon: "info",         bar: "bg-blue-300"  },
};

const DURATION = 3500;

// ── Component ──────────────────────────────────────────────────────
export function Toast({
  toast,
  onClose,
}: {
  toast: ToastData;
  onClose: () => void;
}) {
  const [visible,  setVisible]  = useState(false);
  const [progress, setProgress] = useState(100);
  const cfg = CONFIG[toast.type];

  // Slide in on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Progress bar countdown
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(pct);
      if (pct === 0) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    const id = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // wait for slide-out
    }, DURATION);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-[9999] flex flex-col overflow-hidden rounded-xl shadow-2xl text-white min-w-[260px] max-w-sm
        transition-all duration-300
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        ${cfg.bg}`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className="material-symbols-outlined text-xl shrink-0"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {cfg.icon}
        </span>
        <p className="text-sm font-semibold flex-1 leading-snug">{toast.msg}</p>
        <button
          onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
          className="opacity-60 hover:opacity-100 transition-opacity shrink-0"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-0.5 bg-white/10">
        <div
          className={`h-full ${cfg.bar} transition-none`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ── Hook ───────────────────────────────────────────────────────────
export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);

  function showToast(msg: string, type: ToastType = "success") {
    // Reset then set to re-trigger animation if already showing
    setToast(null);
    setTimeout(() => setToast({ msg, type }), 10);
  }

  function clearToast() {
    setToast(null);
  }

  const toastEl = toast ? (
    <Toast toast={toast} onClose={clearToast} />
  ) : null;

  return { showToast, toastEl };
}
