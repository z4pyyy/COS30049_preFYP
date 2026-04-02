"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";

interface Props {
  name: string;
  email: string;
}

export default function ProfileDropdown({ name, email }: Props) {
  const [open,       setOpen]       = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref    = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const { showToast, toastEl } = useToast();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    setOpen(false);
    await supabase.auth.signOut();
    showToast("Signed out successfully.", "success");
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1200);
  }

  const initial = (name || email || "?")[0].toUpperCase();

  return (
    <>
      {toastEl}
      <div ref={ref} className="relative">
        {/* Avatar button */}
        <button
          onClick={() => setOpen((o) => !o)}
          title={name || email}
          className="w-9 h-9 rounded-full bg-[#012d1d] flex items-center justify-center text-white text-sm font-bold hover:bg-[#024a2f] transition-colors ring-2 ring-[#012d1d]/20 hover:ring-[#012d1d]/40 active:scale-95"
        >
          {signingOut
            ? <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
            : initial
          }
        </button>

        {/* Dropdown */}
        {open && !signingOut && (
          <div className="absolute right-0 top-11 w-52 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* User info */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-900 truncate">{name || "User"}</p>
              <p className="text-[11px] text-gray-400 truncate">{email}</p>
            </div>

            {/* Actions */}
            <div className="py-1">
              <a
                href="/profile"
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors active:bg-gray-100"
              >
                <span className="material-symbols-outlined text-[18px] text-gray-400">person</span>
                Profile
              </a>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors active:bg-red-100"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
