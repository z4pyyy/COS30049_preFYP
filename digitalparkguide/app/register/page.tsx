"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function friendlyError(raw: string): string {
  if (raw.includes("already registered") || raw.includes("User already registered"))
    return "This email is already registered. Try signing in instead.";
  if (raw.includes("invalid email")) return "Please enter a valid email address.";
  return raw;
}

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();

  const [fullName,     setFullName]     = useState("");
  const [email,        setEmail]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [success,      setSuccess]      = useState(false);

  async function handleGoogleSignUp() {
    setOauthLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(friendlyError(error.message)); setOauthLoading(false); }
  }

  async function handleEmailSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true); setError(null);

    // Check if email already linked to a provider
    const { data: provider } = await supabase.rpc("get_user_provider", { p_email: email });
    if (provider && provider !== "email") {
      setError("This email is linked to a Google account. Please use 'Continue with Google'.");
      setLoading(false); return;
    }

    const existingUser = !!provider;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: !existingUser,
        data: existingUser ? undefined : { full_name: fullName },
        emailRedirectTo: existingUser
          ? undefined
          : `${window.location.origin}/auth/callback?full_name=${encodeURIComponent(fullName)}`,
      },
    });

    setLoading(false);
    if (error) { setError(friendlyError(error.message)); return; }

    if (existingUser) {
      router.push(`/verify-otp?email=${encodeURIComponent(email)}&existing=1`);
      return;
    }
    setSuccess(true);
  }

  return (
    <main className="relative flex min-h-screen bg-surface">
      {/* Left panel */}
      <section className="hidden md:flex md:w-1/2 lg:w-3/5 relative bg-primary items-end p-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            className="w-full h-full object-cover opacity-60"
            style={{ backgroundBlendMode: "color-burn", backgroundColor: "rgba(1,45,29,0.2)" }}
            src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&q=80"
            alt=""
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent" />
        </div>
        <div className="relative z-10 space-y-6 max-w-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-1 bg-tertiary-container" />
            <span className="text-xs uppercase tracking-widest text-on-primary-container font-label">Biodiversity Unit</span>
          </div>
          <h1 className="font-headline text-5xl lg:text-7xl font-extrabold text-white tracking-tighter leading-none">
            Guardian<br />Portal
          </h1>
          <p className="text-white/80 text-lg leading-relaxed max-w-md">
            Secure access for Sarawak Forestry Corporation personnel. Monitoring, training,
            and incident management in the heart of Borneo.
          </p>
        </div>
      </section>

      {/* Right panel */}
      <section className="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center p-6 md:p-12 lg:p-24 bg-surface">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-primary text-3xl">shield_person</span>
              <span className="text-xl font-bold tracking-tighter text-primary">Digital Sentinel</span>
            </div>
            <h2 className="font-headline text-3xl font-bold text-on-surface tracking-tight">Create Account</h2>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              Join the SFC Digital Training platform. We&apos;ll send a verification link to your email.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-error-container/40 rounded-xl p-4">
              <span className="material-symbols-outlined text-error text-xl mt-0.5">error</span>
              <div>
                <p className="text-xs font-bold text-on-error-container">Error</p>
                <p className="text-[10px] text-on-error-container/80">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-3 bg-primary-fixed rounded-xl p-4">
              <span className="material-symbols-outlined text-primary text-xl mt-0.5">mark_email_read</span>
              <div>
                <p className="text-xs font-bold text-on-primary-fixed">Check your email</p>
                <p className="text-[10px] text-on-primary-fixed/80">Click the link in your inbox to confirm your account.</p>
              </div>
            </div>
          )}

          <div className="space-y-5">
            {/* Google */}
            <button
              type="button" onClick={handleGoogleSignUp}
              disabled={oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 bg-surface-container-lowest text-on-surface py-4 px-6 rounded-xl shadow-[0_20px_40px_rgba(25,28,29,0.06)] hover:bg-surface-container transition-all border border-outline-variant/10 disabled:opacity-50"
            >
              {oauthLoading
                ? <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                : <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
              }
              <span className="font-medium">Continue with Google</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-outline-variant/20" />
              <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Or with email</span>
              <div className="h-px flex-1 bg-outline-variant/20" />
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-on-surface-variant mb-2 ml-1 font-bold">Full Name</label>
                <input
                  type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ahmad bin Ibrahim"
                  className="w-full bg-surface-container-high border-none rounded-xl py-4 px-5 focus:ring-2 focus:ring-surface-tint/20 transition-all placeholder:text-on-surface-variant/40 outline-none font-medium"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-on-surface-variant mb-2 ml-1 font-bold">Email Address</label>
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-surface-container-high border-none rounded-xl py-4 px-5 focus:ring-2 focus:ring-surface-tint/20 transition-all placeholder:text-on-surface-variant/40 outline-none font-medium"
                />
              </div>
              <button
                type="submit" disabled={loading || oauthLoading || success}
                className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg shadow-[0_10px_20px_rgba(1,45,29,0.25)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading
                  ? <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                  : <>Send Verification Link <span className="material-symbols-outlined text-xl">arrow_forward</span></>
                }
              </button>
            </form>
          </div>

          <div className="text-center">
            <p className="text-sm text-on-surface-variant">
              Already registered?{" "}
              <Link href="/login" className="text-primary font-bold hover:underline">Sign In</Link>
            </p>
          </div>
        </div>
      </section>

      <footer className="hidden md:flex absolute bottom-0 left-0 w-full py-6 bg-emerald-950/80 backdrop-blur-sm justify-between items-center px-12 gap-4 text-xs text-emerald-100/50">
        <span>© 2024 Sarawak Forestry Corporation</span>
        <div className="flex gap-6">
          {["Accessibility", "Privacy Policy", "Contact Sentinel"].map((l) => (
            <a key={l} href="#" className="opacity-70 hover:opacity-100 transition-opacity">{l}</a>
          ))}
        </div>
      </footer>
    </main>
  );
}
