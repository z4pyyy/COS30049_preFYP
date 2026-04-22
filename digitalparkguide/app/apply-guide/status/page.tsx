"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TopNavClient from "@/components/TopNavClient";

type AppStatus = "PENDING" | "UNDER_REVIEW" | "INTERVIEW_SCHEDULED" | "APPROVED" | "REJECTED";

type Application = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  tpa_name: string;
  track_id: string | null;
  motivation: string;
  experience: string;
  status: AppStatus;
  reviewer_notes: string;
  submitted_at: string;
  reviewed_at: string | null;
  interview_date: string | null;
  interview_time: string | null;
  interview_location: string | null;
  document_count: number;
  training_tracks: { title: string } | null;
};

type DocumentRow = {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
  signed_url: string | null;
};

const STATUS_CONFIG: Record<AppStatus, {
  icon: string; iconBg: string; iconColor: string; badge: string;
  title: string; description: string;
}> = {
  PENDING: {
    icon: "hourglass_top", iconBg: "bg-amber-100", iconColor: "text-amber-700",
    badge: "bg-amber-100 text-amber-800",
    title: "Application Submitted",
    description: "Your application has been received and is queued for the HoD's initial review.",
  },
  UNDER_REVIEW: {
    icon: "reviews", iconBg: "bg-blue-100", iconColor: "text-blue-700",
    badge: "bg-blue-100 text-blue-800",
    title: "Application Under Review",
    description: "The HoD is actively reviewing your application. You'll hear back once a decision or interview is scheduled.",
  },
  INTERVIEW_SCHEDULED: {
    icon: "event_available", iconBg: "bg-indigo-100", iconColor: "text-indigo-700",
    badge: "bg-indigo-100 text-indigo-800",
    title: "Interview Scheduled",
    description: "An interview has been booked. Details are below — please arrive at least 10 minutes early.",
  },
  APPROVED: {
    icon: "verified", iconBg: "bg-emerald-100", iconColor: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-800",
    title: "Application Approved",
    description: "Congratulations! Your account has been upgraded to Guide access.",
  },
  REJECTED: {
    icon: "cancel", iconBg: "bg-red-100", iconColor: "text-red-700",
    badge: "bg-red-100 text-red-800",
    title: "Application Not Successful",
    description: "Your application was reviewed and was not approved. Please read the reviewer's feedback below.",
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatInterviewDateTime(date: string, time: string | null) {
  const d = new Date(`${date}T${time || "00:00"}`);
  return d.toLocaleString("en-MY", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ApplicationStatusPage() {
  const router = useRouter();
  const supabase = createClient();

  const [app, setApp] = useState<Application | null>(null);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [noApp, setNoApp] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login?next=/apply-guide/status"); return; }

      const { data } = await supabase
        .from("guide_applications")
        .select("*, training_tracks(title)")
        .eq("applicant_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) { setNoApp(true); setLoading(false); return; }
      setApp(data as Application);

      // Load documents via the API so RLS + signed URLs happen server-side
      const res = await fetch(`/api/applications/${data.id}/documents`, { cache: "no-store" });
      if (res.ok) {
        const body = await res.json();
        setDocs(body.documents ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
        </div>
      </PageShell>
    );
  }

  if (noApp) {
    return (
      <PageShell>
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-gray-500 text-3xl">description</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No application yet</h2>
          <p className="text-gray-500 text-sm mb-6">You haven&apos;t submitted a guide application.</p>
          <Link href="/apply-guide"
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#024a2f] transition-colors">
            Start an Application
          </Link>
        </div>
      </PageShell>
    );
  }

  if (!app) return null;

  const cfg = STATUS_CONFIG[app.status];
  const showInterview = app.status === "INTERVIEW_SCHEDULED" && app.interview_date;
  const showReviewerNotes = app.reviewer_notes && (app.status === "REJECTED" || app.status === "INTERVIEW_SCHEDULED");

  return (
    <PageShell>
      {/* Status header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className={`w-20 h-20 ${cfg.iconBg} rounded-3xl flex items-center justify-center mb-5`}>
          <span className={`material-symbols-outlined ${cfg.iconColor} text-4xl`}
            style={{ fontVariationSettings: "'FILL' 1" }}>
            {cfg.icon}
          </span>
        </div>
        <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${cfg.badge} mb-3`}>
          {app.status.replace(/_/g, " ")}
        </span>
        <h2 className="text-3xl font-extrabold text-gray-900">{cfg.title}</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md leading-relaxed">{cfg.description}</p>
      </div>

      {/* Interview card — only for INTERVIEW_SCHEDULED */}
      {showInterview && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-indigo-700">event</span>
            <p className="font-bold text-indigo-900">Your Interview</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="font-semibold text-indigo-900 w-20 shrink-0">When:</span>
              <span className="text-gray-800">{formatInterviewDateTime(app.interview_date!, app.interview_time)}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-indigo-900 w-20 shrink-0">Where:</span>
              <span className="text-gray-800">{app.interview_location}</span>
            </div>
          </div>
        </div>
      )}

      {/* Reviewer notes */}
      {showReviewerNotes && (
        <div className={`rounded-2xl p-5 mb-6 ${app.status === "REJECTED" ? "bg-red-50 border border-red-200" : "bg-gray-50 border border-gray-200"}`}>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
            {app.status === "REJECTED" ? "Reviewer Feedback" : "Notes from HoD"}
          </p>
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{app.reviewer_notes}</p>
        </div>
      )}

      {/* Application summary */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 divide-y divide-gray-200 mb-6">
        <Row label="Submitted"    value={formatDate(app.submitted_at)} />
        {app.reviewed_at && <Row label="Last Reviewed" value={formatDate(app.reviewed_at)} />}
        <Row label="TPA"          value={app.tpa_name} />
        <Row label="Track"        value={app.training_tracks?.title ?? "Undecided"} />
        <Row label="Full Name"    value={app.full_name} />
        <Row label="Email"        value={app.email} />
        <Row label="Phone"        value={app.phone ?? "—"} />
      </div>

      {/* Documents */}
      {app.document_count > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
            Supporting Documents ({app.document_count})
          </p>
          {docs.length === 0 ? (
            <p className="text-sm text-gray-500">Loading documents…</p>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <a
                  key={d.id}
                  href={d.signed_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-3 transition-colors"
                >
                  <span className="material-symbols-outlined text-gray-500">description</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{d.file_name}</p>
                    <p className="text-[11px] text-gray-500">
                      {(d.file_size / 1024).toFixed(0)} KB · uploaded {formatDate(d.uploaded_at)}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 text-base">open_in_new</span>
                </a>
              ))}
            </div>
          )}
          {(app.status === "APPROVED" || app.status === "REJECTED") && (
            <p className="text-[11px] text-amber-700 mt-3">
              ⓘ Documents will be automatically deleted 30 days after your review date.
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 px-5 py-3">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest w-28 shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-gray-900 font-medium wrap-break-word">{value}</span>
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <TopNavClient />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to Home
          </Link>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}