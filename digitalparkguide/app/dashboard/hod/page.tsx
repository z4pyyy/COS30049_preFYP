"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HodDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main dashboard applications
    router.replace("/dashboard?action=applications");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center">
      <div className="text-center">
        <span className="material-symbols-outlined animate-spin text-[#012d1d] text-4xl mb-4 block">
          progress_activity
        </span>
        <p className="text-gray-600">Redirecting to Applications...</p>
      </div>
    </div>
  );
}
