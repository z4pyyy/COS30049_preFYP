"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TopNavClient from "@/components/TopNavClient";

type Application = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  tpa_name: string;
  track_id: string | null;
  motivation: string;
  experience: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewer_notes: string;
  submitted_at: string;
  reviewed_at: string | null;
  training_tracks: { title: string } | null;
};

const STATUS_CONFIG = {
  PENDING: {
    icon: "hourglass_top",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    badge: "bg-amber-100 text-amber-800",
    title: "Application Under Review",
    description: "Your application has been submitted and is currently being reviewed by the HoD. We'll update your status here once a decision is made.",
  },
  APPROVED: {
    icon: "verified",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-800",
    title: "Application Approved",
    description: "Congratulations! Your guide certification application has been approved. Your account has been upgraded to Guide access.",
  },
  REJECTED: {
    icon: "cancel",
    iconBg: "bg-red-100",
    iconColor: "text-red-700",
    badge: "bg-red-100 text-red-800",
    title: "Application Not Successful",
    description: "Your application was reviewed and was not approved at this time. Please read the reviewer's feedback below.",
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ApplicationStatusPage() {
  const router = useRouter();
  const supabase = createClient();

  const [app,     setApp]     = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [noApp,   setNoApp]   = useState(false);

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

      if (!data) { setNoApp(true); } else { setApp(data as Application); }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-[#012d1d] text-3xl">progress_activity</span>
        </div>
      </PageShell>
    );
  }

  if (noApp) {
    return (
      <PageShell>
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-gray-400 text-3xl">assignment</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Application Found</h2>
          <p className="text-gray-500 text-sm mb-6">You haven't submitted a guide application yet.</p>
          <Link href="/apply-guide"
            className="inline-flex items-center gap-2 bg-[#012d1d] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#024a2f] transition-colors">
            Apply Now
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </div>
      </PageShell>
    );
  }

  const config = STATUS_CONFIG[app!.status];

  return (
    <PageShell>
      {/* Status hero */}
      <div className="text-center pb-6 border-b border-gray-100 mb-6">
        <div className={`w-16 h-16 ${config.iconBg} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
          <span className={`material-symbols-outlined text-3xl ${config.iconColor}`}
            style={{ fontVariationSettings: "'FILL' 1" }}>{config.icon}</span>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 ${config.badge}`}>
          {app!.status}
        </span>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{config.title}</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">{config.description}</p>

        {app!.status === "APPROVED" && (
          <Link href="/dashboard"
            className="inline-flex items-center gap-2 mt-5 bg-[#012d1d] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#024a2f] transition-colors">
            <span className="material-symbols-outlined text-base">dashboard</span>
            Go to Dashboard
          </Link>
        )}
        {app!.status === "REJECTED" && (
          <Link href="/apply-guide"
            className="inline-flex items-center gap-2 mt-5 bg-[#012d1d] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#024a2f] transition-colors">
            <span className="material-symbols-outlined text-base">refresh</span>
            Apply Again
          </Link>
        )}
      </div>

      {/* Reviewer notes (if reviewed) */}
      {app!.reviewer_notes && (
        <div className={`rounded-xl p-4 mb-6 border
          ${app!.status === "APPROVED"
            ? "bg-emerald-50 border-emerald-200"
            : "bg-red-50 border-red-200"}`}>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-1">Reviewer's Notes</p>
          <p className="text-sm text-gray-800 leading-relaxed">{app!.reviewer_notes}</p>
        </div>
      )}

      {/* Application details */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-200">
        <div className="px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Application Details</p>
        </div>
        {[
          { label: "Name",        value: app!.full_name },
          { label: "Email",       value: app!.email },
          { label: "Phone",       value: app!.phone || "—" },
          { label: "TPA",         value: app!.tpa_name },
          { label: "Track",       value: app!.training_tracks?.title || "Undecided" },
          { label: "Submitted",   value: formatDate(app!.submitted_at) },
          { label: "Reviewed",    value: app!.reviewed_at ? formatDate(app!.reviewed_at) : "Pending" },
        ].map(({ label, value }) => (
          <div key={label} className="flex gap-4 px-5 py-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-24 shrink-0 mt-0.5">{label}</span>
            <span className="text-sm text-gray-900 font-medium">{value}</span>
          </div>
        ))}
        <div className="px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Motivation</p>
          <p className="text-sm text-gray-800 leading-relaxed">{app!.motivation}</p>
        </div>
        <div className="px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Experience</p>
          <p className="text-sm text-gray-800 leading-relaxed">{app!.experience}</p>
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link href="/" className="text-xs text-gray-500 hover:text-[#012d1d] font-semibold transition-colors">
          ← Back to Home
        </Link>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <TopNavClient />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
