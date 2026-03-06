"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface UserInfo {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export default function UserMenu() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
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

  if (!user) return null;

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email?.[0]?.toUpperCase() || "?";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full hover:ring-2 hover:ring-slate-200 transition"
        title={user.email || "Account"}
      >
        {user.image ? (
          <img
            src={user.image}
            alt={user.name || "User"}
            className="w-8 h-8 rounded-full border border-slate-200"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
            {initials}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name || "User"}
                    className="w-10 h-10 rounded-full border border-slate-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {user.name && (
                    <div className="text-sm font-semibold text-slate-900 truncate">{user.name}</div>
                  )}
                  {user.email && (
                    <div className="text-xs text-slate-400 truncate">{user.email}</div>
                  )}
                </div>
              </div>
            </div>
            <div className="py-1">
              <button
                onClick={async () => {
                  setSigningOut(true);
                  try {
                    // Get CSRF token
                    const csrfRes = await fetch("/api/auth/csrf");
                    const { csrfToken } = await csrfRes.json();
                    // POST to sign out
                    await fetch("/api/auth/signout", {
                      method: "POST",
                      headers: { "Content-Type": "application/x-www-form-urlencoded" },
                      body: new URLSearchParams({ csrfToken }),
                    });
                    // Clear any stale cookies
                    await fetch("/api/auth/clear").catch(() => {});
                    router.push("/");
                    router.refresh();
                  } catch {
                    // Fallback: just redirect
                    window.location.href = "/";
                  }
                }}
                disabled={signingOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-50 transition text-slate-600 hover:text-red-600 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="text-sm font-medium">{signingOut ? "Signing out…" : "Sign out"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
