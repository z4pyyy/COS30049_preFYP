"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

const OTP_LENGTH = 6;

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const next  = searchParams.get("next")  ?? "/";

  const [digits,    setDigits]    = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [resent,    setResent]    = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const supabase = createClient();
  const otp = digits.join("");

  function handleChange(index: number, value: string) {
    const char = value.replace(/\D/g, "").slice(-1);
    const next_ = [...digits];
    next_[index] = char;
    setDigits(next_);
    setError(null);
    if (char && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (pasted.length === OTP_LENGTH) {
      setDigits(pasted.split(""));
      inputRefs.current[OTP_LENGTH - 1]?.focus();
      e.preventDefault();
    }
  }

  async function handleVerify(e: { preventDefault(): void }) {
    e.preventDefault();
    if (otp.length < OTP_LENGTH) { setError("Please enter all 6 digits."); return; }
    setLoading(true); setError(null);

    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
    setLoading(false);

    if (error) {
      if (error.message.includes("expired") || error.message.includes("Otp has expired")) {
        setError("This code has expired. Request a new one below.");
      } else if (error.message.includes("invalid") || error.message.includes("Token has expired or is invalid")) {
        setError("Invalid code. Check your email and try again.");
      } else {
        setError(error.message);
      }
      setDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleResend() {
    setResending(true); setError(null); setResent(false);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setResending(false);
    if (error) { setError(error.message); return; }
    setResent(true);
    setDigits(Array(OTP_LENGTH).fill(""));
    inputRefs.current[0]?.focus();
  }

  return (
    <main className="flex min-h-screen">
      {/* Left branding panel */}
      <section className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&q=80')" }}
        />
        <div className="rainforest-overlay absolute inset-0" />
        <div className="relative z-10 w-full p-16 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-12">
            <span className="material-symbols-outlined text-primary-fixed text-4xl">forest</span>
            <h1 className="text-white font-headline font-black text-2xl tracking-tighter uppercase">
              SFC Digital Training
            </h1>
          </div>
          <div className="space-y-6 max-w-lg">
            <h2 className="text-white text-5xl font-black leading-tight tracking-tight">
              Secure. <span className="text-primary-fixed">Verified.</span>
            </h2>
            <p className="text-on-primary-container text-lg leading-relaxed font-medium">
              We sent a one-time verification code to your registered work email.
              It expires in 10 minutes.
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
            <span className="material-symbols-outlined text-primary text-3xl">mark_email_unread</span>
          </div>

          <div className="mb-10">
            <h3 className="text-on-surface text-3xl font-black tracking-tight mb-2">Check Your Email</h3>
            <p className="text-secondary font-medium">
              We sent a 6-digit code to{" "}
              <span className="text-on-surface font-bold">{email || "your email"}</span>
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 bg-error-container text-on-error-container rounded-xl px-4 py-3 text-sm font-medium">
              <span className="material-symbols-outlined text-base mt-0.5">error</span>
              {error}
            </div>
          )}

          {resent && (
            <div className="mb-6 flex items-start gap-3 bg-primary-fixed text-on-primary-fixed rounded-xl px-4 py-3 text-sm font-medium">
              <span className="material-symbols-outlined text-base mt-0.5">mark_email_read</span>
              New code sent! Check your inbox.
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-8">
            <div className="flex gap-3 justify-center" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className={`w-12 h-14 text-center text-2xl font-black rounded-xl border-2 bg-surface-container text-on-surface outline-none transition-all
                    ${d ? "border-primary bg-primary-fixed/10" : "border-outline-variant"}
                    focus:border-primary focus:bg-primary-fixed/10 focus:ring-2 focus:ring-primary/20`}
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < OTP_LENGTH}
              className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-primary/90 active:scale-[0.98] transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              ) : (
                <>Verify Code <span className="material-symbols-outlined text-xl">verified</span></>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-secondary text-sm font-medium">
              Didn&apos;t receive the code?{" "}
              <button
                type="button" onClick={handleResend} disabled={resending}
                className="text-primary font-bold hover:underline underline-offset-4 disabled:opacity-50"
              >
                {resending ? "Sending…" : "Resend"}
              </button>
            </p>
          </div>

          <p className="mt-8 text-center text-on-surface-variant font-medium text-sm">
            <Link href="/login" className="flex items-center justify-center gap-1 text-secondary hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Back to Sign In
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense>
      <VerifyOtpForm />
    </Suspense>
  );
}
