"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthError() {
  const router = useRouter();
  const [clearing, setClearing] = useState(true);

  useEffect(() => {
    // Clear stale auth cookies and redirect to login
    fetch("/api/auth/clear")
      .catch(() => {})
      .finally(() => {
        setClearing(false);
        // Small delay so the cookie clear takes effect
        setTimeout(() => router.push("/login"), 500);
      });
  }, [router]);

  return (
    <div className="min-h-screen bg-[#eef0f4] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-slate-200/60 p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">🔄</div>
        <h1 className="text-lg font-bold text-slate-900 mb-2">
          {clearing ? "Refreshing session…" : "Redirecting to login…"}
        </h1>
        <p className="text-sm text-slate-500">
          Your session expired. Signing you back in automatically.
        </p>
      </div>
    </div>
  );
}
