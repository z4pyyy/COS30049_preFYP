"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";

function friendlyError(raw: string): string {
  if (raw.includes("Invalid login credentials")) return "Incorrect email or password.";
  if (raw.includes("Email not confirmed"))        return "Please verify your email first.";
  if (raw.includes("Too many requests"))          return "Too many attempts — please wait and try again.";
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [loading,      setLoading]      = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error,        setError]        = useState<string | null>(
    searchParams.get("error") ? friendlyError(searchParams.get("message") ?? "Sign-in failed.") : null
  );

  const supabase = createClient();
  const { showToast, toastEl } = useToast();

  const [adminBlocked,   setAdminBlocked]   = useState(false);
  const [showPassword,   setShowPassword]   = useState(false);

  async function handleGoogleSignIn() {
    setOauthLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${next}` },
    });
    if (error) { setError(friendlyError(error.message)); setOauthLoading(false); }
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true); setError(null); setAdminBlocked(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        if (email.toLowerCase().includes("admin")) {
          setAdminBlocked(true);
          return;
        }
        const { data: provider } = await supabase.rpc("get_user_provider", { p_email: email });
        if (provider && provider !== "email") {
          setError("This email is linked to a Google account. Please use 'Sign in with Google' above.");
        } else {
          setError("Incorrect email or password.");
        }
      } else {
        setError(friendlyError(error.message));
      }
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user && !user.user_metadata?.has_password) {
      await supabase.auth.updateUser({ data: { has_password: true } });
    }
    showToast("Signed in successfully. Welcome back!", "success");
    setTimeout(() => { router.push(next); router.refresh(); }, 1000);
  }

  async function handleOtpSignIn() {
    if (!email) { setError("Enter your work email to receive a code."); return; }
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("signups not allowed") || msg.includes("user not found") || msg.includes("not registered")) {
        router.push(`/register?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(friendlyError(error.message));
      return;
    }
    showToast("Code sent! Check your inbox.", "info");
    setTimeout(() => router.push(`/verify-otp?email=${encodeURIComponent(email)}&next=${next}`), 800);
  }

  return (
    <>
    {toastEl}
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-primary">
      {/* Forest background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-primary/30 mix-blend-multiply z-10" />
        <img
          src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=1600&q=80"
          alt=""
          className="w-full h-full object-cover grayscale-[20%] blur-sm scale-105"
        />
      </div>

      <div className="absolute top-10 left-10 hidden lg:block opacity-40 z-20 text-[10px] font-mono text-white tracking-[0.2em] leading-relaxed uppercase">
        Coord: 1.5533° N, 110.3592° E<br />
        Sentinel Active: 04 nodes<br />
        System: Canopy Intelligence v4.2
      </div>

      <main className="relative z-30 w-full max-w-[480px] px-6">
        <div
          className="p-8 md:p-12 rounded-xl shadow-2xl shadow-primary/20 flex flex-col gap-8"
          style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
        >
          <div className="flex flex-col items-center text-center">
            <div className="mb-6">
              <div className="w-20 h-20 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
                <span className="material-symbols-outlined text-primary-fixed text-4xl">forest</span>
              </div>
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-primary uppercase leading-tight">
              SFC Digital Training
            </h1>
            <p className="text-secondary font-medium text-sm mt-2 tracking-wide uppercase">
              Forestry Training Command
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-error-container/70 text-on-error-container rounded-xl px-4 py-3 text-sm font-medium">
              <span className="material-symbols-outlined text-base mt-0.5">error</span>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {/* Google OAuth */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={oauthLoading || loading}
              className="w-full h-14 bg-surface-container-lowest hover:bg-white flex items-center justify-center gap-3 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] outline outline-1 outline-outline-variant/15 disabled:opacity-50"
            >
              {oauthLoading ? (
                <span className="material-symbols-outlined animate-spin text-on-surface">progress_activity</span>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              <span className="font-semibold text-on-surface text-sm">Sign in with Google</span>
            </button>

            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-outline-variant/20" />
              <span className="text-[10px] uppercase tracking-widest text-secondary font-bold">Or use email</span>
              <div className="h-px flex-1 bg-outline-variant/20" />
            </div>

            {/* Email + password form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1">Work Email</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">alternate_email</span>
                  <input
                    type="email" required value={email}
                    onChange={(e) => { setEmail(e.target.value); setAdminBlocked(false); }}
                    placeholder="name@forestry.gov.my"
                    className="w-full h-14 pl-12 pr-4 bg-surface-container-high border-0 rounded-xl focus:ring-2 focus:ring-surface-tint focus:bg-white transition-all placeholder:text-outline/50 font-medium outline-none"
                  />
                </div>
                {adminBlocked && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 font-medium">
                    <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                    Admin accounts are not permitted here — use your official SFC credentials.
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Password</label>
                  <a href="#" className="text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-primary transition-colors">Forgot Password?</a>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">lock</span>
                  <input
                    type={showPassword ? "text" : "password"} required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-14 pl-12 pr-12 bg-surface-container-high border-0 rounded-xl focus:ring-2 focus:ring-surface-tint focus:bg-white transition-all placeholder:text-outline/50 font-medium outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]" translate="no">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit" disabled={loading || oauthLoading || adminBlocked}
                className="w-full h-14 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-sm mt-2 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading
                  ? <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  : <>Enter Sentinel <span className="material-symbols-outlined text-xl">arrow_forward</span></>
                }
              </button>
            </form>

            {/* OTP shortcut */}
            <button
              type="button" onClick={handleOtpSignIn}
              disabled={loading || oauthLoading || adminBlocked}
              className="text-sm text-secondary font-semibold hover:text-primary transition-colors disabled:opacity-50"
            >
              Sign in with one-time code instead
            </button>
          </div>

          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-on-surface-variant font-medium">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-primary font-bold hover:underline underline-offset-4">Register</Link>
            </p>
            <div className="flex gap-4 items-center">
              {["Privacy", "Security", "SFC Website"].map((l, i) => (
                <span key={l} className="flex items-center gap-4">
                  {i > 0 && <span className="w-1 h-1 rounded-full bg-outline-variant" />}
                  <a href="#" className="text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-on-surface transition-colors">{l}</a>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center px-2 opacity-60">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
            <span className="text-[10px] font-bold text-white uppercase tracking-tighter">Live Incident Feed: Active</span>
          </div>
          <span className="text-[10px] font-medium text-white/70 uppercase">v1.0.0-Production</span>
        </div>
      </main>

      <footer className="absolute bottom-6 w-full text-center z-30">
        <p className="text-[9px] font-bold text-white/50 uppercase tracking-[0.3em]">
          © 2024 Sarawak Forestry Corporation. Guardians of Biodiversity.
        </p>
      </footer>
    </div>
    </>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
