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

  const sectionColors: Record<string, string> = {
    indoor: "bg-blue-100 text-blue-800",
    outdoor: "bg-green-100 text-green-800",
    bar: "bg-purple-100 text-purple-800",
    private: "bg-amber-100 text-amber-800",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🍽️ TableCall</h1>
            <p className="text-sm text-gray-500">AI-Powered Restaurant Reservations</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm text-gray-600">Agent Active</span>
            </div>
            <a
              href="/settings"
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
            >
              ⚙️ Settings
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <p className="text-sm text-gray-500">Today&apos;s Reservations</p>
            <p className="text-3xl font-bold text-gray-900">{reservations.length}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <p className="text-sm text-gray-500">Total Guests</p>
            <p className="text-3xl font-bold text-gray-900">
              {reservations.reduce((sum, r) => sum + r.party_size, 0)}
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <p className="text-sm text-gray-500">Tables Available</p>
            <p className="text-3xl font-bold text-gray-900">
              {12 - reservations.length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <p className="text-sm text-gray-500">Calls Handled</p>
            <p className="text-3xl font-bold text-gray-900">—</p>
          </div>
        </div>

        {/* Date Picker & Reservations */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Reservations</h2>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm text-gray-700"
            />
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading...</div>
          ) : reservations.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 text-lg">No reservations for this date</p>
              <p className="text-gray-300 text-sm mt-1">
                Reservations made via phone will appear here automatically
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {reservations
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((reservation) => (
                  <div
                    key={reservation.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px]">
                        <p className="text-lg font-bold text-gray-900">
                          {formatTime(reservation.time)}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {reservation.guest_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          Party of {reservation.party_size}
                          {reservation.special_requests &&
                            ` · ${reservation.special_requests}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          sectionColors[(reservation.section_name || "indoor").toLowerCase()] || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {reservation.section_name || "—"}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Confirmed
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
