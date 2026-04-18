"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageLoader } from "@/components/ui/PageLoader";
import { useToast } from "@/components/ui/Toast";
import TopNavClient from "@/components/TopNavClient";

const SPECIAL_CHAR_RE = /[<>{}[\]|\\^~#$%]/;
function hasSpecialChars(v: string) { return SPECIAL_CHAR_RE.test(v); }
function stripSpecialChars(v: string) { return v.replace(SPECIAL_CHAR_RE, ""); }

type Track = {
  id: string;
  title: string;
  tpa_name: string;
  duration_weeks: number;
  eligibility: string;
};

type ExistingApp = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

const STEPS = ["Personal Details", "Park & Track", "Your Background", "Review"];

export default function ApplyGuidePage() {
  const router = useRouter();
  const supabase = createClient();

  const { showToast, toastEl } = useToast();
  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [step,         setStep]         = useState(0);
  const [existingApp,  setExistingApp]  = useState<ExistingApp | null>(null);
  const [alreadyGuide, setAlreadyGuide] = useState(false);
  const [tracks,       setTracks]       = useState<Track[]>([]);
  const [error,        setError]        = useState<string | null>(null);

  // Form fields
  const [fullName,    setFullName]    = useState("");
  const [email,       setEmail]       = useState("");
  const [phone,       setPhone]       = useState("");
  const [tpaName,     setTpaName]     = useState("");
  const [trackId,     setTrackId]     = useState("");
  const [motivation,  setMotivation]  = useState("");
  const [experience,  setExperience]  = useState("");

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login?next=/apply-guide"); return; }

      const [{ data: profile }, { data: app }, { data: trackData }] = await Promise.all([
        supabase.from("profiles").select("full_name, role, phone").eq("id", user.id).single(),
        supabase.from("guide_applications").select("id, status").eq("applicant_id", user.id)
          .order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("training_tracks")
          .select("id, title, tpa_name, duration_weeks, eligibility")
          .eq("track_type", "GUIDE").eq("is_open", true).order("tpa_name"),
      ]);

      if (profile && ["GUIDE","SENIOR_GUIDE","HOD","SUPERADMIN"].includes(profile.role)) {
        setAlreadyGuide(true);
        setLoading(false);
        return;
      }

      if (app) { setExistingApp(app as ExistingApp); setLoading(false); return; }

      setFullName(profile?.full_name || user.user_metadata?.full_name || "");
      setEmail(user.email || "");
      setPhone(profile?.phone || "");
      setTracks((trackData as Track[]) ?? []);
      setLoading(false);
    }
    init();
  }, []);

  const tpaOptions = [...new Set(tracks.map((t) => t.tpa_name))].sort();
  const tracksForTpa = tracks.filter((t) => t.tpa_name === tpaName);

  async function handleSubmit() {
    setSubmitting(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login?next=/apply-guide"); return; }

    const { error } = await supabase.from("guide_applications").insert({
      applicant_id: user.id,
      full_name:    fullName.trim(),
      email:        email.trim(),
      phone:        phone.trim() || null,
      tpa_name:     tpaName,
      track_id:     trackId || null,
      motivation:   motivation.trim(),
      experience:   experience.trim(),
    });

    setSubmitting(false);
    if (error) { setError(error.message); return; }
    showToast("Application submitted successfully!", "success");
    setTimeout(() => router.push("/apply-guide/status"), 1000);
  }

  function canNext() {
    if (step === 0) return fullName.trim().length > 0 && email.trim().length > 0;
    if (step === 1) return tpaName.length > 0;
    if (step === 2) return motivation.trim().length >= 50 && experience.trim().length >= 20;
    return true;
  }

  // ── Loading ────────────────────────────────────────────────────
  if (loading) return <PageLoader message="Loading application…" />;

  // ── Already a guide ────────────────────────────────────────────
  if (alreadyGuide) {
    return (
      <Shell>
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-emerald-700 text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're already a certified guide</h2>
          <p className="text-gray-500 text-sm mb-6">Your account already has Guide access or higher.</p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 bg-[#012d1d] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#024a2f] transition-colors">
            Go to Dashboard
          </Link>
        </div>
      </Shell>
    );
  }

  // ── Existing application ───────────────────────────────────────
  if (existingApp) {
    const isPending  = existingApp.status === "PENDING";
    const isApproved = existingApp.status === "APPROVED";
    const isRejected = existingApp.status === "REJECTED";
    return (
      <Shell>
        <div className="text-center py-16">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5
            ${isPending ? "bg-amber-100" : isApproved ? "bg-emerald-100" : "bg-red-100"}`}>
            <span className={`material-symbols-outlined text-3xl
              ${isPending ? "text-amber-700" : isApproved ? "text-emerald-700" : "text-red-700"}`}
              style={{ fontVariationSettings: "'FILL' 1" }}>
              {isPending ? "hourglass_top" : isApproved ? "verified" : "cancel"}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isPending  ? "Application Under Review"    : ""}
            {isApproved ? "Application Approved!"       : ""}
            {isRejected ? "Application Not Successful"  : ""}
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {isPending  ? "Your application has been submitted and is being reviewed by the HoD."         : ""}
            {isApproved ? "Congratulations! You now have Guide access."                                    : ""}
            {isRejected ? "Your application was not approved. You may view the reviewer's feedback below." : ""}
          </p>
          <Link href="/apply-guide/status"
            className="inline-flex items-center gap-2 bg-[#012d1d] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#024a2f] transition-colors">
            View Full Status
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </div>
      </Shell>
    );
  }

  // ── Multi-step form ────────────────────────────────────────────
  return (
    <>
    {toastEl}
    <Shell>
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center gap-0 mb-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center gap-2 ${i <= step ? "text-[#012d1d]" : "text-gray-400"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                  ${i < step  ? "bg-[#012d1d] border-[#012d1d] text-white"
                  : i === step ? "border-[#012d1d] text-[#012d1d]"
                  :              "border-gray-300 text-gray-400"}`}>
                  {i < step
                    ? <span className="material-symbols-outlined text-sm">check</span>
                    : i + 1}
                </div>
                <span className="text-xs font-semibold hidden sm:block">{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i < step ? "bg-[#012d1d]" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm font-medium">
          <span className="material-symbols-outlined text-base mt-0.5">error</span>
          {error}
        </div>
      )}

      {/* ── Step 0: Personal Details ── */}
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Personal Details</h2>
            <p className="text-sm text-gray-500">Confirm your details as they will appear on your application.</p>
          </div>
          <Field label="Full Name" required>
            <input type="text" value={fullName}
              onChange={e => setFullName(stripSpecialChars(e.target.value))}
              placeholder="As per NRIC" className={INPUT} />
            {hasSpecialChars(fullName) && <SpecialCharWarning />}
          </Field>
          <Field label="Email Address" required>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" className={INPUT} />
          </Field>
          <Field label="Phone Number" hint="Optional">
            <input type="tel" value={phone}
              onChange={e => setPhone(stripSpecialChars(e.target.value))}
              placeholder="+60 12-xxx xxxx" className={INPUT} />
            {hasSpecialChars(phone) && <SpecialCharWarning />}
          </Field>
        </div>
      )}

      {/* ── Step 1: Park & Track ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Park & Training Track</h2>
            <p className="text-sm text-gray-500">Each badge is park-specific and non-transferable between parks.</p>
          </div>
          <Field label="Totally Protected Area (TPA)" required>
            <select value={tpaName} onChange={e => { setTpaName(e.target.value); setTrackId(""); }}
              className={SELECT}>
              <option value="">Select a park…</option>
              {tpaOptions.map(t => <option key={t} value={t}>{t}</option>)}
              {tpaOptions.length === 0 && <option value="Bako National Park">Bako National Park</option>}
            </select>
          </Field>
          {tpaName && (
            <Field label="Preferred Training Track" hint="Optional — skip if unsure">
              {tracksForTpa.length === 0 ? (
                <p className="text-sm text-gray-500 italic py-2">No open tracks for this TPA yet. You may still apply.</p>
              ) : (
                <div className="space-y-2">
                  {tracksForTpa.map(track => (
                    <label key={track.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${trackId === track.id ? "border-[#012d1d] bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <input type="radio" name="track" value={track.id}
                        checked={trackId === track.id}
                        onChange={() => setTrackId(track.id)}
                        className="mt-1 accent-[#012d1d]" />
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{track.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{track.duration_weeks} weeks · {track.eligibility}</p>
                      </div>
                    </label>
                  ))}
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                    ${trackId === "" ? "border-[#012d1d] bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <input type="radio" name="track" value=""
                      checked={trackId === ""}
                      onChange={() => setTrackId("")}
                      className="mt-1 accent-[#012d1d]" />
                    <div>
                      <p className="font-semibold text-sm text-gray-900">Undecided</p>
                      <p className="text-xs text-gray-500 mt-0.5">I'll discuss track selection with the HoD.</p>
                    </div>
                  </label>
                </div>
              )}
            </Field>
          )}
        </div>
      )}

      {/* ── Step 2: Background ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Your Background</h2>
            <p className="text-sm text-gray-500">Help the HoD understand why you're a good fit.</p>
          </div>
          <Field label="Motivation" required hint={`${motivation.length} chars — min 50`}>
            <textarea value={motivation}
              onChange={e => setMotivation(stripSpecialChars(e.target.value))} rows={5}
              placeholder="Why do you want to become a certified guide for this park? What draws you to this role?"
              className={`${INPUT} resize-none`} />
            {hasSpecialChars(motivation) && <SpecialCharWarning />}
          </Field>
          <Field label="Prior Experience" required hint={`${experience.length} chars — min 20`}>
            <textarea value={experience}
              onChange={e => setExperience(stripSpecialChars(e.target.value))} rows={4}
              placeholder="Describe any relevant experience — forestry, ecology, tourism, guiding, conservation, etc."
              className={`${INPUT} resize-none`} />
            {hasSpecialChars(experience) && <SpecialCharWarning />}
          </Field>
        </div>
      )}

      {/* ── Step 3: Review ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Review & Submit</h2>
            <p className="text-sm text-gray-500">Review your application before submitting. The HoD will be notified.</p>
          </div>
          <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-200">
            {[
              { label: "Full Name",   value: fullName },
              { label: "Email",       value: email },
              { label: "Phone",       value: phone || "—" },
              { label: "TPA",         value: tpaName },
              { label: "Track",       value: tracks.find(t => t.id === trackId)?.title || "Undecided" },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-4 px-5 py-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest w-28 shrink-0 mt-0.5">{label}</span>
                <span className="text-sm text-gray-900 font-medium">{value}</span>
              </div>
            ))}
            <div className="px-5 py-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Motivation</span>
              <p className="text-sm text-gray-900 leading-relaxed">{motivation}</p>
            </div>
            <div className="px-5 py-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Experience</span>
              <p className="text-sm text-gray-900 leading-relaxed">{experience}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            By submitting, you confirm all information is accurate. The HoD will review your application
            and you'll be notified of the outcome via the platform.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
        {step > 0 ? (
          <button onClick={() => setStep(s => s - 1)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back
          </button>
        ) : (
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Cancel
          </Link>
        )}

        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
            className="flex items-center gap-2 bg-[#012d1d] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#024a2f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            Continue
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-2 bg-[#012d1d] text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#024a2f] transition-colors disabled:opacity-60">
            {submitting
              ? <><span className="material-symbols-outlined animate-spin text-base">progress_activity</span> Submitting…</>
              : <><span className="material-symbols-outlined text-base">send</span> Submit Application</>
            }
          </button>
        )}
      </div>
    </Shell>
    </>
  );
}

// ── Shared sub-components ──────────────────────────────────────────

const INPUT = "w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-sm font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-[#012d1d]/20 focus:border-[#012d1d] outline-none transition-all";
const SELECT = "w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#012d1d]/20 focus:border-[#012d1d] outline-none transition-all cursor-pointer";

function SpecialCharWarning() {
  return (
    <div className="flex items-center gap-1.5 mt-1 text-amber-700 text-[11px] font-medium">
      <span className="material-symbols-outlined text-sm">warning</span>
      Special characters are not allowed and have been removed.
    </div>
  );
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-gray-600">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {hint && <span className="text-[10px] text-gray-400 font-medium">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <TopNavClient />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Page title */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-[#012d1d] rounded-xl flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white text-2xl">hiking</span>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Guide Certification Application</h1>
            <p className="text-sm text-gray-500">Sarawak Forestry Corporation · Biodiversity Unit</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
