"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

const RULES = [
  { label: "At least 8 characters",       test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter (A–Z)",   test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter (a–z)",   test: (p: string) => /[a-z]/.test(p) },
  { label: "One number (0–9)",             test: (p: string) => /\d/.test(p) },
  { label: "One special character (!@#…)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const results = useMemo(() => RULES.map((r) => r.test(password)), [password]);
  const allPassed = results.every(Boolean);
  const matched = password === confirm && confirm.length > 0;

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!allPassed) { setError("Password does not meet all requirements."); return; }
    if (!matched) { setError("Passwords do not match."); return; }

    setLoading(true); setError(null);

    const { error: updateErr } = await supabase.auth.updateUser({
      password,
      data: { has_password: true },
    });

    setLoading(false);
    if (updateErr) { setError(updateErr.message); return; }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen">
      {/* Left branding panel */}
      <section className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&q=80')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent" />
        <div className="relative z-10 w-full p-16 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-12">
            <span className="material-symbols-outlined text-primary-fixed text-4xl">forest</span>
            <h1 className="text-white font-headline font-black text-2xl tracking-tighter uppercase">
              SFC Digital Training
            </h1>
          </div>
          <div className="space-y-6 max-w-lg">
            <h2 className="text-white text-5xl font-black leading-tight tracking-tight">
              Secure Your <span className="text-primary-fixed">Account.</span>
            </h2>
            <p className="text-on-primary-container text-lg leading-relaxed font-medium">
              Set a strong password so you can sign in quickly next time — no email code needed.
            </p>
          </div>
        </div>
      </section>

      {/* Right form panel */}
      <section className="w-full lg:w-1/2 flex items-center justify-center p-8 md:p-16 bg-surface-container-lowest">
        <div className="max-w-md w-full">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-primary text-3xl">forest</span>
            <span className="text-primary font-bold tracking-tighter uppercase text-sm">SFC Digital</span>
          </div>

          <div className="w-16 h-16 bg-primary-fixed rounded-2xl flex items-center justify-center mb-8">
            <span className="material-symbols-outlined text-primary text-3xl">lock_reset</span>
          </div>

          <div className="mb-8">
            <h3 className="text-on-surface text-3xl font-black tracking-tight mb-2">Set Your Password</h3>
            <p className="text-secondary font-medium text-sm">
              Create a password for your account so you can sign in with email &amp; password next time.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 bg-error-container/70 text-on-error-container rounded-xl px-4 py-3 text-sm font-medium">
              <span className="material-symbols-outlined text-base mt-0.5">error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Password field */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1">
                New Password
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">lock</span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  placeholder="••••••••"
                  className="w-full h-14 pl-12 pr-14 bg-surface-container-high border-0 rounded-xl focus:ring-2 focus:ring-surface-tint focus:bg-white transition-all placeholder:text-outline/50 font-medium outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Requirements checklist */}
            <div className="bg-surface-container rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Requirements</p>
              {RULES.map((rule, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={`material-symbols-outlined text-base ${results[i] ? "text-primary" : "text-outline-variant"}`}>
                    {results[i] ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span className={results[i] ? "text-on-surface font-medium" : "text-on-surface-variant"}>
                    {rule.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1">
                Confirm Password
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">lock_clock</span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                  placeholder="••••••••"
                  className="w-full h-14 pl-12 pr-4 bg-surface-container-high border-0 rounded-xl focus:ring-2 focus:ring-surface-tint focus:bg-white transition-all placeholder:text-outline/50 font-medium outline-none"
                />
              </div>
              {confirm && !matched && (
                <p className="text-xs text-error font-medium px-1">Passwords do not match.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !allPassed || !matched}
              className="w-full h-14 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                <>Set Password <span className="material-symbols-outlined text-xl">shield</span></>
              )}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
