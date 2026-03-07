"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import RestaurantSwitcher from "@/components/RestaurantSwitcher";
import UserMenu from "@/components/UserMenu";

interface Guest {
  id: string;
  phone: string;
  name: string;
  email?: string | null;
  visit_count: number;
  last_visit_date?: string | null;
  notes?: string | null;
  tags?: string | null;
  created_at: string;
}

interface Reservation {
  id: string;
  guest_name: string;
  party_size: number;
  date: string;
  time: string;
  section_name?: string;
  special_requests?: string;
  status: string;
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export default function GuestsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"recent" | "visits" | "name">("recent");
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [guestReservations, setGuestReservations] = useState<Reservation[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [tagsValue, setTagsValue] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchGuests();
  }, [sort]);

  async function fetchGuests() {
    setLoading(true);
    try {
      const res = await fetch(`/api/r/${slug}/guests?sort=${sort}&limit=100`);
      const data = await res.json();
      setGuests(data.guests || []);
      setTotal(data.total || 0);
    } catch {
      console.error("Failed to load guests");
    }
    setLoading(false);
  }

  async function selectGuest(guest: Guest) {
    setSelectedGuest(guest);
    setNotesValue(guest.notes || "");
    setTagsValue(guest.tags || "");
    setEditingNotes(false);
    setEditingTags(false);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/r/${slug}/guests?id=${guest.id}`);
      const data = await res.json();
      setGuestReservations(data.reservations || []);
    } catch {
      setGuestReservations([]);
    }
    setLoadingDetail(false);
  }

  async function saveNotes() {
    if (!selectedGuest) return;
    try {
      const res = await fetch(`/api/r/${slug}/guests`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: selectedGuest.id, notes: notesValue }),
      });
      const data = await res.json();
      if (data.guest) {
        setSelectedGuest(data.guest);
        setGuests(guests.map(g => g.id === data.guest.id ? data.guest : g));
        showMessage("✅ Notes saved");
      }
    } catch {
      showMessage("❌ Failed to save");
    }
    setEditingNotes(false);
  }

  async function saveTags() {
    if (!selectedGuest) return;
    try {
      const res = await fetch(`/api/r/${slug}/guests`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: selectedGuest.id, tags: tagsValue }),
      });
      const data = await res.json();
      if (data.guest) {
        setSelectedGuest(data.guest);
        setGuests(guests.map(g => g.id === data.guest.id ? data.guest : g));
        showMessage("✅ Tags saved");
      }
    } catch {
      showMessage("❌ Failed to save");
    }
    setEditingTags(false);
  }

  function showMessage(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  }

  const regulars = guests.filter(g => g.visit_count >= 3).length;
  const newGuests = guests.filter(g => g.visit_count <= 1).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eef0f4] flex items-center justify-center">
        <div className="animate-pulse text-slate-400 text-lg">Loading guests...</div>
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
              <h1 className="text-xl font-bold text-slate-900">👥 Guests</h1>
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

      {/* Toast */}
      {message && (
        <div className="fixed top-20 right-6 z-50">
          <div className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">{message}</div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:pt-24 space-y-4 sm:space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-[#ffffff] rounded-2xl p-3 sm:p-5 border border-slate-200/60 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">{total}</p>
            <p className="text-xs text-slate-400 mt-1">Total Guests</p>
          </div>
          <div className="bg-[#ffffff] rounded-2xl p-3 sm:p-5 border border-slate-200/60 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{regulars}</p>
            <p className="text-xs text-slate-400 mt-1">Regulars (3+)</p>
          </div>
          <div className="bg-[#ffffff] rounded-2xl p-3 sm:p-5 border border-slate-200/60 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-blue-600">{newGuests}</p>
            <p className="text-xs text-slate-400 mt-1">New Guests</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          {/* Guest List */}
          <div className="flex-1 bg-[#ffffff] rounded-2xl border border-slate-200/60 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-b border-slate-200/60 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Guest Directory</h2>
                <p className="text-sm text-slate-400">{total} guest{total !== 1 ? "s" : ""}</p>
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as "recent" | "visits" | "name")}
                className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600"
              >
                <option value="recent">Most recent</option>
                <option value="visits">Most visits</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>

            {guests.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <div className="text-4xl mb-3">👥</div>
                <p className="text-slate-500 font-medium">No guest profiles yet</p>
                <p className="text-sm text-slate-400 mt-1">
                  Guest profiles are created automatically when reservations include a phone number.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {guests.map((guest) => {
                  const isSelected = selectedGuest?.id === guest.id;
                  return (
                    <button
                      key={guest.id}
                      onClick={() => selectGuest(guest)}
                      className={`w-full text-left px-4 sm:px-6 py-3 sm:py-4 hover:bg-slate-50 transition flex items-center gap-3 ${
                        isSelected ? "bg-blue-50 border-l-4 border-blue-500" : ""
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        guest.visit_count >= 5 ? "bg-amber-100 text-amber-700" :
                        guest.visit_count >= 3 ? "bg-emerald-100 text-emerald-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {guest.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm truncate">{guest.name}</span>
                          {guest.visit_count >= 5 && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">⭐ VIP</span>}
                          {guest.visit_count >= 3 && guest.visit_count < 5 && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">Regular</span>}
                          {guest.tags && <span className="text-xs text-slate-400 truncate hidden sm:inline">{guest.tags}</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatPhone(guest.phone)} · {guest.visit_count} visit{guest.visit_count !== 1 ? "s" : ""}
                          {guest.last_visit_date && ` · Last: ${formatDate(guest.last_visit_date)}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Guest Detail Panel */}
          {selectedGuest && (
            <div className="lg:w-[400px] bg-[#ffffff] rounded-2xl border border-slate-200/60 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 bg-slate-50 border-b border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${
                    selectedGuest.visit_count >= 5 ? "bg-amber-100 text-amber-700" :
                    selectedGuest.visit_count >= 3 ? "bg-emerald-100 text-emerald-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {selectedGuest.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{selectedGuest.name}</h3>
                    <p className="text-sm text-slate-500">{formatPhone(selectedGuest.phone)}</p>
                  </div>
                </div>
                <div className="flex gap-4 mt-3">
                  <div className="text-center">
                    <p className="text-xl font-bold text-slate-900">{selectedGuest.visit_count}</p>
                    <p className="text-[10px] text-slate-400 uppercase">Visits</p>
                  </div>
                  {selectedGuest.last_visit_date && (
                    <div className="text-center">
                      <p className="text-xl font-bold text-slate-900">{formatDate(selectedGuest.last_visit_date)}</p>
                      <p className="text-[10px] text-slate-400 uppercase">Last Visit</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                {/* Tags */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tags</label>
                    {!editingTags && (
                      <button onClick={() => setEditingTags(true)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                    )}
                  </div>
                  {editingTags ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tagsValue}
                        onChange={(e) => setTagsValue(e.target.value)}
                        placeholder="vip, regular, wine-lover..."
                        className="flex-1 bg-[#eef0f4] border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                        autoFocus
                      />
                      <button onClick={saveTags} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold">Save</button>
                      <button onClick={() => setEditingTags(false)} className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-xs">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {selectedGuest.tags ? selectedGuest.tags.split(",").map((tag, i) => (
                        <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{tag.trim()}</span>
                      )) : <span className="text-xs text-slate-400 italic">No tags</span>}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Notes</label>
                    {!editingNotes && (
                      <button onClick={() => setEditingNotes(true)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                    )}
                  </div>
                  {editingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        placeholder="Allergies, seating preferences, special occasions..."
                        rows={3}
                        className="w-full bg-[#eef0f4] border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button onClick={saveNotes} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold">Save</button>
                        <button onClick={() => setEditingNotes(false)} className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-xs">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">{selectedGuest.notes || <span className="italic text-slate-400">No notes</span>}</p>
                  )}
                </div>

                {/* Reservation History */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Reservation History</label>
                  {loadingDetail ? (
                    <div className="text-sm text-slate-400 animate-pulse">Loading...</div>
                  ) : guestReservations.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No reservations found</p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {guestReservations.map((r) => (
                        <div key={r.id} className="bg-[#eef0f4] rounded-xl p-3 border border-slate-200/60">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-900">{formatDate(r.date)} · {formatTime12h(r.time)}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${r.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                              {r.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Party of {r.party_size}{r.section_name ? ` · ${r.section_name}` : ""}
                            {r.special_requests ? ` · "${r.special_requests}"` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
