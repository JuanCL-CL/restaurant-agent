"use client";

import { useState, useEffect } from "react";

interface Reservation {
  id: string;
  guest_name: string;
  party_size: number;
  date: string;
  time: string;
  table_id: string;
  section_name?: string;
  special_requests?: string;
  phone?: string;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReservations();
  }, [selectedDate]);

  async function fetchReservations() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reservations?date=${selectedDate}`);
      const data = await res.json();
      setReservations(data.reservations || []);
    } catch {
      console.error("Failed to fetch reservations");
    }
    setLoading(false);
  }

  const formatTime = (time: string) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const timeSlots = reservations.reduce((acc, r) => {
    const key = r.time;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {} as Record<string, Reservation[]>);

  const sortedSlots = Object.keys(timeSlots).sort();
  const totalGuests = reservations.reduce((sum, r) => sum + r.party_size, 0);

  return (
    <div className="min-h-screen bg-[#eef0f4]">
      {/* Header */}
      <header className="bg-[#ffffff]/90 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">🍽️ TableCall</h1>
            <p className="text-sm text-slate-400">AI-Powered Reservations</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-sm text-slate-500">Agent Active</span>
            </div>
            <a
              href="/settings"
              className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition text-sm font-medium"
            >
              ⚙️ Settings
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Date Navigation */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => shiftDate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-[#e8eaef] border border-slate-200/60 hover:bg-[#dfe2e8] transition text-slate-500"
            >
              ←
            </button>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900">{formatDateDisplay(selectedDate)}</h2>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-sm text-slate-400 bg-transparent border-none text-center cursor-pointer hover:text-slate-600 transition"
              />
            </div>
            <button
              onClick={() => shiftDate(1)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-[#e8eaef] border border-slate-200/60 hover:bg-[#dfe2e8] transition text-slate-500"
            >
              →
            </button>
          </div>
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
            className="px-4 py-2 text-sm font-medium text-slate-500 bg-[#e8eaef] border border-slate-200/60 rounded-lg hover:bg-[#dfe2e8] transition"
          >
            Today
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#ffffff] rounded-2xl p-5 border border-slate-200/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg">📋</div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{reservations.length}</p>
                <p className="text-xs text-slate-400">Reservations</p>
              </div>
            </div>
          </div>
          <div className="bg-[#ffffff] rounded-2xl p-5 border border-slate-200/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg">👥</div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{totalGuests}</p>
                <p className="text-xs text-slate-400">Total Guests</p>
              </div>
            </div>
          </div>
          <div className="bg-[#ffffff] rounded-2xl p-5 border border-slate-200/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-lg">🪑</div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{sortedSlots.length}</p>
                <p className="text-xs text-slate-400">Time Slots</p>
              </div>
            </div>
          </div>
          <div className="bg-[#ffffff] rounded-2xl p-5 border border-slate-200/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-lg">📞</div>
              <div>
                <p className="text-2xl font-bold text-slate-900">—</p>
                <p className="text-xs text-slate-400">Calls Today</p>
              </div>
            </div>
          </div>
        </div>

        {/* Reservations Timeline */}
        {loading ? (
          <div className="bg-[#ffffff] rounded-2xl border border-slate-200/60 p-16 text-center">
            <div className="animate-pulse text-slate-400 text-lg">Loading reservations...</div>
          </div>
        ) : reservations.length === 0 ? (
          <div className="bg-[#ffffff] rounded-2xl border border-slate-200/60 p-16 text-center">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-slate-500 text-lg font-medium">No reservations for {formatDateDisplay(selectedDate)}</p>
            <p className="text-slate-400 text-sm mt-1">
              Reservations made via phone will appear here automatically
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedSlots.map((time) => (
              <div key={time}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-sm font-bold">
                    {formatTime(time)}
                  </div>
                  <div className="flex-1 h-px bg-slate-100"></div>
                  <span className="text-sm text-slate-400">
                    {timeSlots[time].length} reservation{timeSlots[time].length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ml-2">
                  {timeSlots[time].map((reservation) => (
                    <div
                      key={reservation.id}
                      className="bg-[#ffffff] rounded-xl border border-slate-200/60 hover:border-slate-200 transition-all p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-900 text-lg">
                            {reservation.guest_name}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm text-slate-500">
                              👥 {reservation.party_size} guest{reservation.party_size !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                          Confirmed
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {reservation.section_name && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500">
                            📍 {reservation.section_name}
                          </span>
                        )}
                        {reservation.special_requests && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
                            ⚠️ {reservation.special_requests}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
