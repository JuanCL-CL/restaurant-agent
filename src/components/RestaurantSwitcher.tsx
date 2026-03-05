"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Restaurant {
  id: string;
  slug: string;
  name: string;
}

export default function RestaurantSwitcher({ currentSlug }: { currentSlug: string }) {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/my-restaurants")
      .then((r) => r.json())
      .then((data) => setRestaurants(data.restaurants || []))
      .catch(() => {});
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = restaurants.find((r) => r.slug === currentSlug);
  if (restaurants.length <= 1) {
    // Just show restaurant name, no switcher needed
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900">🍽️ {current?.name || "TableCall"}</h1>
        <p className="text-sm text-slate-400">AI-Powered Reservations</p>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 group"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            🍽️ {current?.name || "TableCall"}
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </h1>
          <p className="text-sm text-slate-400">AI-Powered Reservations</p>
        </div>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-72 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your restaurants</span>
            </div>
            <div className="py-1">
              {restaurants.map((r) => {
                const isCurrent = r.slug === currentSlug;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setOpen(false);
                      if (!isCurrent) router.push(`/r/${r.slug}`);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                      isCurrent
                        ? "bg-blue-50 text-blue-700"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                        isCurrent
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {r.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">{r.name}</div>
                      <div className="text-xs text-slate-400">/{r.slug}</div>
                    </div>
                    {isCurrent && (
                      <span className="text-xs font-semibold text-blue-500">Current</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-100">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/onboarding");
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition text-slate-500"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-lg">+</div>
                <span className="text-sm font-medium">Add restaurant</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
