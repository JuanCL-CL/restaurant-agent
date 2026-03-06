"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";

interface Restaurant {
  id: string;
  slug: string;
  name: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingRestaurants, setExistingRestaurants] = useState<Restaurant[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if user already has restaurants
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data) => {
        if (data.restaurants?.length > 0) {
          setExistingRestaurants(data.restaurants);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!name.trim() || name.trim().length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    if (name.trim().length > 50) {
      setError("Name must be 50 characters or less");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setCreating(false);
        return;
      }

      if (data.redirect) {
        router.push(data.redirect);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eef0f4] flex items-center justify-center">
        <div className="animate-pulse text-slate-400 text-lg">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef0f4] flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        {/* Existing restaurants */}
        {existingRestaurants.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Your restaurants</h2>
            <div className="space-y-2">
              {existingRestaurants.map((r) => (
                <button
                  key={r.id}
                  onClick={() => router.push(`/r/${r.slug}`)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition border border-slate-200/60"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold">
                      {r.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-slate-900">{r.name}</div>
                      <div className="text-xs text-slate-400">/{r.slug}</div>
                    </div>
                  </div>
                  <span className="text-slate-400">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Create new */}
        <div className="bg-white rounded-2xl border border-slate-200/60 p-8 shadow-sm text-center">
          <div className="flex justify-center mb-4"><Logo size={56} /></div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {existingRestaurants.length > 0 ? "Add another restaurant" : "Set up your restaurant"}
          </h1>
          <p className="text-slate-500 mb-8">
            {existingRestaurants.length > 0
              ? "Create a new restaurant with its own dashboard and AI agent."
              : "Give your restaurant a name to get started. You can customize everything else later."}
          </p>

          <div className="text-left">
            <label className="block text-sm font-medium text-slate-500 mb-2">Restaurant name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Marco's Italian Kitchen"
              maxLength={50}
              autoFocus
              className="w-full bg-[#eef0f4] border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-lg"
            />
            {name.trim().length >= 2 && (
              <p className="text-xs text-slate-400 mt-2">
                Your dashboard will be at <span className="font-mono text-slate-500">/r/{name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}</span>
              </p>
            )}
            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || name.trim().length < 2}
            className="w-full mt-6 px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? "Creating…" : "Create restaurant →"}
          </button>
        </div>
      </div>
    </div>
  );
}
