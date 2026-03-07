"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import RestaurantSwitcher from "@/components/RestaurantSwitcher";
import UserMenu from "@/components/UserMenu";

interface TranscriptMessage {
  role: "assistant" | "caller" | string;
  text: string;
}

interface Call {
  id: string;
  vapi_call_id: string;
  call_type: string;
  caller_phone?: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  ended_reason?: string;
  summary?: string;
  transcript?: TranscriptMessage[];
  recording_url?: string;
  cost?: number;
  created_at: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatEndedReason(reason: string | null): { label: string; color: string } {
  switch (reason) {
    case "customer-ended-call":
      return { label: "Caller hung up", color: "text-slate-500" };
    case "assistant-ended-call":
      return { label: "AI ended call", color: "text-blue-500" };
    case "silence-timed-out":
      return { label: "Silence timeout", color: "text-amber-500" };
    case "max-duration-reached":
      return { label: "Max duration", color: "text-amber-500" };
    case "error":
      return { label: "Error", color: "text-red-500" };
    default:
      return { label: reason || "Unknown", color: "text-slate-400" };
  }
}

export default function CallsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [calls, setCalls] = useState<Call[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

  useEffect(() => {
    fetchCalls();
  }, []);

  async function fetchCalls() {
    setLoading(true);
    try {
      const res = await fetch(`/api/r/${slug}/calls?limit=50`);
      const data = await res.json();
      setCalls(data.calls || []);
      setTotal(data.total || 0);
    } catch {
      console.error("Failed to load calls");
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eef0f4] flex items-center justify-center">
        <div className="animate-pulse text-slate-400 text-lg">Loading call history...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef0f4]">
      {/* Header */}
      <header className="bg-[#ffffff]/95 backdrop-blur-md border-b border-slate-200/60 sm:fixed sm:top-0 sm:left-0 sm:right-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <RestaurantSwitcher currentSlug={slug} />
            <span className="text-slate-300 hidden sm:inline">›</span>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-slate-900">📞 Call History</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href={`/r/${slug}`}
              className="px-3 sm:px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-zinc-200 transition text-sm font-medium"
            >
              ← <span className="hidden sm:inline">Dashboard</span><span className="sm:hidden">Back</span>
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Toast area for future use */}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:pt-24 space-y-4 sm:space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-[#ffffff] rounded-2xl p-3 sm:p-5 border border-slate-200/60 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">{total}</p>
            <p className="text-xs text-slate-400 mt-1">Total Calls</p>
          </div>
          <div className="bg-[#ffffff] rounded-2xl p-3 sm:p-5 border border-slate-200/60 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">
              {calls.length > 0 ? formatDuration(Math.round(calls.reduce((s, c) => s + (c.duration_seconds || 0), 0) / calls.length)) : "—"}
            </p>
            <p className="text-xs text-slate-400 mt-1">Avg Duration</p>
          </div>
          <div className="bg-[#ffffff] rounded-2xl p-3 sm:p-5 border border-slate-200/60 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">
              {calls.filter((c) => c.call_type === "inboundPhoneCall").length}
            </p>
            <p className="text-xs text-slate-400 mt-1">Phone Calls</p>
          </div>
          <div className="bg-[#ffffff] rounded-2xl p-3 sm:p-5 border border-slate-200/60 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">
              {calls.filter((c) => c.call_type === "webCall").length}
            </p>
            <p className="text-xs text-slate-400 mt-1">Web Calls</p>
          </div>
        </div>

        {/* Call List */}
        <div className="bg-[#ffffff] rounded-2xl border border-slate-200/60 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-b border-slate-200/60">
            <h2 className="text-lg font-semibold text-slate-900">Recent Calls</h2>
            <p className="text-sm text-slate-400">Click a call to view the full transcript</p>
          </div>

          {calls.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <div className="text-4xl mb-3">📞</div>
              <p className="text-slate-500 font-medium">No calls recorded yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Call history will appear here after your AI agent takes its first call.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {calls.map((call) => {
                const isExpanded = expandedCall === call.id;
                const endedInfo = formatEndedReason(call.ended_reason || null);
                const isPhone = call.call_type === "inboundPhoneCall";

                return (
                  <div key={call.id}>
                    {/* Call row */}
                    <button
                      onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                      className="w-full text-left px-4 sm:px-6 py-3 sm:py-4 hover:bg-slate-50 transition flex items-center gap-3 sm:gap-4"
                    >
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                        isPhone ? "bg-blue-50" : "bg-purple-50"
                      }`}>
                        {isPhone ? "📱" : "🌐"}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm truncate">
                            {call.caller_phone || (isPhone ? "Phone call" : "Web call")}
                          </span>
                          <span className={`text-xs ${endedInfo.color}`}>{endedInfo.label}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          {call.summary || "No summary available"}
                        </p>
                      </div>

                      {/* Meta */}
                      <div className="text-right flex-shrink-0 hidden sm:block">
                        <div className="text-sm font-medium text-slate-700">{formatTime(call.started_at)}</div>
                        <div className="text-xs text-slate-400">{formatDuration(call.duration_seconds)}</div>
                      </div>
                      <div className="text-right flex-shrink-0 sm:hidden">
                        <div className="text-xs text-slate-500">{formatTime(call.started_at)}</div>
                        <div className="text-xs text-slate-400">{formatDuration(call.duration_seconds)}</div>
                      </div>

                      {/* Expand indicator */}
                      <svg
                        className={`w-4 h-4 text-slate-300 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expanded transcript */}
                    {isExpanded && (
                      <div className="px-4 sm:px-6 pb-4 sm:pb-6 bg-slate-50/50">
                        {/* Summary */}
                        {call.summary && (
                          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Summary</div>
                            <p className="text-sm text-blue-900">{call.summary}</p>
                          </div>
                        )}

                        {/* Transcript */}
                        {call.transcript && Array.isArray(call.transcript) && call.transcript.length > 0 ? (
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Transcript</div>
                            {call.transcript.map((msg, i) => {
                              const isAI = msg.role === "assistant" || msg.role === "bot";
                              return (
                                <div key={i} className={`flex gap-2 ${isAI ? "" : "justify-end"}`}>
                                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                                    isAI
                                      ? "bg-white border border-slate-200 text-slate-800"
                                      : "bg-slate-900 text-white"
                                  }`}>
                                    <div className={`text-[10px] font-semibold mb-0.5 ${isAI ? "text-blue-500" : "text-slate-300"}`}>
                                      {isAI ? "AI Agent" : "Caller"}
                                    </div>
                                    {msg.text}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No transcript available for this call.</p>
                        )}

                        {/* Recording */}
                        {call.recording_url && (
                          <div className="mt-4">
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Recording</div>
                            <audio controls className="w-full" src={call.recording_url}>
                              Your browser does not support audio playback.
                            </audio>
                          </div>
                        )}

                        {/* Meta details */}
                        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
                          {call.cost !== null && call.cost !== undefined && (
                            <span>Cost: ${call.cost.toFixed(4)}</span>
                          )}
                          <span>Duration: {formatDuration(call.duration_seconds)}</span>
                          <span>Type: {call.call_type === "inboundPhoneCall" ? "Phone" : "Web"}</span>
                          {call.ended_reason && <span>Ended: {endedInfo.label}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
