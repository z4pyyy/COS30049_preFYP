"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageLoader } from "@/components/ui/PageLoader";
import { useToast } from "@/components/ui/Toast";
import TopNavClient from "@/components/TopNavClient";
import ThemedSelect from "@/components/ThemedSelect";

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
  status: "PENDING" | "UNDER_REVIEW" | "INTERVIEW_SCHEDULED" | "APPROVED" | "REJECTED";
};

const STEPS = ["Personal Details", "Park & Track", "Your Background", "Documents", "Review"];

export default function ApplyGuidePage() {
  const [countryCode, setCountryCode] = useState("+60");

  const COUNTRY_CODES = [
    { code: "+60", label: "🇲🇾 +60" },
    { code: "+65", label: "🇸🇬 +65" },
    { code: "+62", label: "🇮🇩 +62" },
    { code: "+63", label: "🇵🇭 +63" },
    { code: "+66", label: "🇹🇭 +66" },
    { code: "+84", label: "🇻🇳 +84" },
    { code: "+44", label: "🇬🇧 +44" },
    { code: "+1",  label: "🇺🇸 +1"  },
  ];
  
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
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string>("");

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

  function handleFilesPicked(list: FileList | null) {
    if (!list) return;
    const MAX = 5;
    const next = [...stagedFiles];
    for (const f of Array.from(list)) {
      if (next.length >= MAX) break;
      if (f.size > 10 * 1024 * 1024) {
        showToast(`${f.name} exceeds 10 MB`, "error");
        continue;
      }
      next.push(f);
    }
    setStagedFiles(next);
  }

  function removeStaged(idx: number) {
    setStagedFiles(stagedFiles.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    setSubmitting(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login?next=/apply-guide"); return; }

    const { data: inserted, error: insErr } = await supabase
      .from("guide_applications")
      .insert({
        applicant_id: user.id,
        full_name:    fullName.trim(),
        email:        email.trim(),
        phone:        phone.trim() || null,
        tpa_name:     tpaName,
        track_id:     trackId || null,
        motivation:   motivation.trim(),
        experience:   experience.trim(),
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      setSubmitting(false);
      setError(insErr?.message ?? "Failed to submit");
      return;
    }

    for (let i = 0; i < stagedFiles.length; i++) {
      const f = stagedFiles[i];
      setUploadProgress(`Uploading ${i + 1}/${stagedFiles.length}: ${f.name}`);
      const form = new FormData();
      form.append("file", f);
      const res = await fetch(`/api/applications/${inserted.id}/documents`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitting(false);
        setUploadProgress("");
        setError(`Upload failed for ${f.name}: ${body.error ?? res.statusText}`);
        return;
      }
    }

    setSubmitting(false);
    setUploadProgress("");
    showToast("Application submitted successfully!", "success");
    setTimeout(() => router.push("/apply-guide/status"), 800);
  }

  function canNext() {
    if (step === 0) return fullName.trim().length > 0 && email.trim().length > 0;
    if (step === 1) return tpaName.length > 0;
    if (step === 2) return motivation.trim().length >= 50 && experience.trim().length >= 20;
    if (step === 3) return true;  // docs are optional
    return true;
  }

  if (loading) return <PageLoader message="Loading application…" />;

  if (alreadyGuide) {
    return (
      <Shell>
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-emerald-700 text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re already a certified guide</h2>
          <p className="text-gray-500 text-sm mb-6">Your account already has Guide access or higher.</p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#024a2f] transition-colors">
            Go to Dashboard
          </Link>
        </div>
      </Shell>
    );
  }

  if (existingApp) {
    // Redirect to status page — it now handles all 5 statuses
    return (
      <Shell>
        <div className="text-center py-16">
          <p className="text-sm text-gray-600 mb-6">You already have an application on file.</p>
          <Link href="/apply-guide/status"
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#024a2f] transition-colors">
            View Application Status
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <>
      {toastEl}
      <Shell>
        {/* Progress indicator */}
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((label, idx) => (
            <div key={label} className="flex-1">
              <div className={`h-1 rounded-full transition-colors ${idx <= step ? "bg-primary" : "bg-gray-200"}`} />
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-1.5 ${
                idx === step ? "text-primary" : idx < step ? "text-gray-500" : "text-gray-300"
              }`}>
                Step {idx + 1}: {label}
              </p>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step 0 — Personal Details */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Personal Details</h2>
              <p className="text-sm text-gray-500">Let&apos;s start with your basics.</p>
            </div>
            <Field label="Full Name" required>
              <input value={fullName} onChange={e => setFullName(stripSpecialChars(e.target.value))} className={INPUT} />
              {hasSpecialChars(fullName) && <SpecialCharWarning />}
            </Field>
            <Field label="Email" required>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Phone">
              <div className="flex gap-2">
                <ThemedSelect
                  value={countryCode}
                  onChange={v => setCountryCode(v)}
                  options={COUNTRY_CODES.map(c => ({ value: c.code, label: c.label }))}
                  className="shrink-0"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => {
                    const digitsOnly = e.target.value.replace(/\D/g, "");
                    setPhone(digitsOnly);
                  }}
                  placeholder="11 2345678"
                  maxLength={15}
                  inputMode="numeric"
                  className={`${INPUT} flex-1`}
                />
              </div>
            </Field>
          </div>
        )}

        {/* Step 1 — Park & Track */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Park &amp; Track</h2>
              <p className="text-sm text-gray-500">Which TPA do you want to serve?</p>
            </div>
            <Field label="Totally Protected Area" required>
              <ThemedSelect
                value={tpaName}
                onChange={v => { setTpaName(v); setTrackId(""); }}
                options={[
                  { value: '', label: '— Select a park —' },
                  ...tpaOptions.map(t => ({ value: t, label: t })),
                ]}
              />
            </Field>
            {tpaName && (
              <Field label="Preferred Certification Track">
                <div className="space-y-2">
                  {tracksForTpa.map(track => (
                    <label key={track.id} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                      ${trackId === track.id ? "border-primary bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <input type="radio" name="track" value={track.id}
                        checked={trackId === track.id}
                        onChange={() => setTrackId(track.id)}
                        className="mt-1 accent-primary" />
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{track.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{track.duration_weeks} weeks · {track.eligibility}</p>
                      </div>
                    </label>
                  ))}
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                    ${trackId === "" ? "border-primary bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <input type="radio" name="track" value=""
                      checked={trackId === ""}
                      onChange={() => setTrackId("")}
                      className="mt-1 accent-primary" />
                    <div>
                      <p className="font-semibold text-sm text-gray-900">Undecided</p>
                      <p className="text-xs text-gray-500 mt-0.5">I&apos;ll discuss track selection with the HoD.</p>
                    </div>
                  </label>
                </div>
              </Field>
            )}
          </div>
        )}

        {/* Step 2 — Background */}
        {step === 2 && (
          <div className="space-y-5">
            ...
            <Field label="Motivation" required hint={`${motivation.length} chars — min 50`}>
              <textarea
                value={motivation}
                onChange={e => {
                  const cleaned = e.target.value.replace(SPECIAL_CHAR_RE, "");
                  setMotivation(cleaned);
                }}
                rows={5}
                placeholder="Why do you want to become a certified guide for this park?"
                className={`${INPUT} resize-none`}
              />
              {/[^a-zA-Z0-9\s,./()\-']/.test(motivation) && <SpecialCharWarning />}
            </Field>

            <Field label="Prior Experience" required hint={`${experience.length} chars — min 20`}>
              <textarea
                value={experience}
                onChange={e => {
                  const cleaned = e.target.value.replace(SPECIAL_CHAR_RE, "");
                  setExperience(cleaned);
                }}
                rows={4}
                placeholder="Describe any relevant experience — forestry, ecology, tourism, guiding, etc."
                className={`${INPUT} resize-none`}
              />
              {/[^a-zA-Z0-9\s,./()\-']/.test(experience) && <SpecialCharWarning />}
            </Field>
          </div>
        )}

        {/* Step 3 — Documents (Task 6) */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Supporting Documents</h2>
              <p className="text-sm text-gray-500">
                Attach up to 5 files (10 MB each). Optional — but recommended if you hold relevant
                certifications (first aid, ecology, tour guide licence, etc.).
              </p>
              <p className="text-[11px] text-amber-700 mt-2">
                ⓘ Documents are retained for 30 days after your application is reviewed, then automatically deleted.
              </p>
            </div>

            <label className="block border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors">
              <span className="material-symbols-outlined text-3xl text-gray-400 mb-2 block">upload_file</span>
              <p className="text-sm font-semibold text-gray-700">Click to select files</p>
              <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, WebP, DOC, DOCX · max 10 MB each</p>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/*"
                className="hidden"
                onChange={e => handleFilesPicked(e.target.files)}
              />
            </label>

            {stagedFiles.length > 0 && (
              <div className="space-y-2">
                {stagedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <span className="material-symbols-outlined text-gray-500">description</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                      <p className="text-[11px] text-gray-500">{(f.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button onClick={() => removeStaged(i)}
                      className="text-red-600 hover:bg-red-50 w-8 h-8 rounded-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4 — Review */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Review &amp; Submit</h2>
              <p className="text-sm text-gray-500">The HoD will be notified once you submit.</p>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-200">
              {[
                { label: "Full Name", value: fullName },
                { label: "Email",     value: email },
                { label: "Phone",     value: phone || "—" },
                { label: "TPA",       value: tpaName },
                { label: "Track",     value: tracks.find(t => t.id === trackId)?.title || "Undecided" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-4 px-5 py-3">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest w-28 shrink-0 mt-0.5">{label}</span>
                  <span className="text-sm text-gray-900 font-medium">{value}</span>
                </div>
              ))}
              {/* Bug 5: list staged documents by name (not just a count) */}
              <div className="px-5 py-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                  Documents ({stagedFiles.length})
                </span>
                {stagedFiles.length === 0 ? (
                  <p className="text-sm text-gray-500">No documents attached.</p>
                ) : (
                  <ul className="space-y-1">
                    {stagedFiles.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 text-sm text-gray-900">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-sm text-gray-500 shrink-0">description</span>
                          <span className="truncate">{f.name}</span>
                        </span>
                        <span className="text-xs text-gray-500 shrink-0">
                          {(f.size / 1024).toFixed(1)} KB
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="px-5 py-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Motivation</span>
                <p className="text-sm text-gray-900 leading-relaxed">{motivation}</p>
              </div>
              <div className="px-5 py-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Experience</span>
                <p className="text-sm text-gray-900 leading-relaxed">{experience}</p>
              </div>
            </div>

            {uploadProgress && (
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                {uploadProgress}
              </p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} disabled={submitting}
              className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-40">
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
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#024a2f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Continue
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#024a2f] transition-colors disabled:opacity-60">
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

const INPUT = "w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-sm font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all";

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
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shrink-0">
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