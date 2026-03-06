"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";

interface Restaurant {
  id: string;
  slug: string;
  name: string;
}

export default function RestaurantSwitcher({ currentSlug }: { currentSlug: string }) {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Restaurant | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/my-restaurants")
      .then((r) => r.json())
      .then((data) => setRestaurants(data.restaurants || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleDelete() {
    if (!deleteTarget || deleteConfirmName !== deleteTarget.name) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/r/${deleteTarget.slug}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: deleteTarget.name }),
      });
      const data = await res.json();
      if (data.success) {
        setDeleteTarget(null);
        setDeleteConfirmName("");
        // Remove from local list
        const remaining = restaurants.filter((r) => r.id !== deleteTarget.id);
        setRestaurants(remaining);
        // Navigate away if we deleted the current one
        if (deleteTarget.slug === currentSlug) {
          if (remaining.length > 0) {
            router.push(`/r/${remaining[0].slug}`);
          } else {
            router.push("/onboarding");
          }
        }
      } else {
        setDeleteError(data.error || "Failed to delete");
      }
    } catch {
      setDeleteError("Something went wrong");
    }
    setDeleting(false);
  }

  const current = restaurants.find((r) => r.slug === currentSlug);

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2.5 group"
        >
          <Logo size={30} />
          <div>
            <h1 className="text-base sm:text-xl font-bold text-slate-900 flex items-center gap-2 truncate">
              {current?.name || "Mesa"}
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
            <p className="text-xs sm:text-sm text-slate-400 hidden sm:block">AI-Powered Reservations</p>
          </div>
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-2 w-80 z-50">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your restaurants</span>
              </div>
              <div className="py-1">
                {restaurants.map((r) => {
                  const isCurrent = r.slug === currentSlug;
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center gap-3 px-4 py-2.5 transition ${
                        isCurrent ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <button
                        onClick={() => {
                          setOpen(false);
                          if (!isCurrent) router.push(`/r/${r.slug}`);
                        }}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                            isCurrent ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {r.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`font-semibold text-sm truncate ${isCurrent ? "text-blue-700" : "text-slate-700"}`}>{r.name}</div>
                          <div className="text-xs text-slate-400">/{r.slug}</div>
                        </div>
                        {isCurrent && (
                          <span className="text-xs font-semibold text-blue-500">Current</span>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                          setDeleteTarget(r);
                          setDeleteConfirmName("");
                          setDeleteError("");
                        }}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition flex-shrink-0"
                        title="Delete restaurant"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
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

      {/* Delete confirmation modal — portaled to body to escape header stacking context */}
      {deleteTarget && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-xl">🗑️</div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Delete {deleteTarget.name}?</h3>
                  <p className="text-sm text-slate-500">This cannot be undone.</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-700">
                <p className="font-semibold mb-2">This will permanently delete:</p>
                <ul className="space-y-1 ml-5 list-disc">
                  <li>All reservations</li>
                  <li>All tables and floor plan</li>
                  <li>All sections and settings</li>
                  <li>The AI phone agent</li>
                </ul>
              </div>

              <label className="block text-sm font-medium text-slate-600 mb-2">
                Type <span className="font-bold text-slate-900">{deleteTarget.name}</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => { setDeleteConfirmName(e.target.value); setDeleteError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleDelete()}
                placeholder={deleteTarget.name}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-300 focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                autoFocus
              />
              {deleteError && <p className="text-sm text-red-500 mt-2">{deleteError}</p>}
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirmName(""); setDeleteError(""); }}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmName !== deleteTarget.name || deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
