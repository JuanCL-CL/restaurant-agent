"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface RestaurantInfo {
  name: string;
  phone: string | null;
  address: string | null;
  openTime: string;
  closeTime: string;
  lastSeating: string;
  reservationDuration: number;
  sections: { id: string; name: string }[];
  maxCapacity: number;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

interface BookingConfirmation {
  reservation: {
    id: string;
    guestName: string;
    partySize: number;
    date: string;
    time: string;
    sectionName?: string;
    specialRequests?: string;
  };
  restaurant: {
    name: string;
    phone?: string;
    address?: string;
  };
}

type Step = "size" | "datetime" | "details" | "confirm" | "done";

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function BookingPage() {
  const params = useParams();
  const slug = params.slug as string;

  // Restaurant info
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Booking form state
  const [step, setStep] = useState<Step>("size");
  const [partySize, setPartySize] = useState(2);
  const [selectedDate, setSelectedDate] = useState(() => localDateStr(new Date()));
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Load restaurant info on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/r/${slug}/book`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Restaurant not found");
          } else {
            setError("Failed to load restaurant info");
          }
          return;
        }
        const data = await res.json();
        setRestaurant(data.restaurant);
      } catch {
        setError("Failed to connect. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  // Load available time slots when date or party size changes
  useEffect(() => {
    if (step !== "datetime" || !selectedDate) return;
    async function loadSlots() {
      setSlotsLoading(true);
      setSelectedTime(null);
      try {
        const res = await fetch(`/api/r/${slug}/book?date=${selectedDate}&partySize=${partySize}`);
        const data = await res.json();
        setSlots(data.slots || []);
      } catch {
        setSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    }
    loadSlots();
  }, [step, selectedDate, partySize, slug]);

  async function handleSubmit() {
    if (!guestName.trim()) {
      setSubmitError("Please enter your name.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/r/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: guestName.trim(),
          partySize,
          date: selectedDate,
          time: selectedTime,
          phone: phone.trim() || undefined,
          specialRequests: specialRequests.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.alternativeTimes?.length) {
          setSubmitError(
            `${data.error} Try: ${data.alternativeTimes.map(formatTime12h).join(", ")}`
          );
        } else {
          setSubmitError(data.error || "Failed to create reservation");
        }
        return;
      }
      setConfirmation(data);
      setStep("done");
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#eef0f4] flex items-center justify-center">
        <div className="animate-pulse text-slate-400 text-lg">Loading...</div>
      </div>
    );
  }

  // Error state
  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-[#eef0f4] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200/60 p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-4">😔</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            {error || "Something went wrong"}
          </h1>
          <p className="text-sm text-slate-500">
            Please check the URL and try again.
          </p>
        </div>
      </div>
    );
  }

  // Confirmation state
  if (step === "done" && confirmation) {
    const { reservation: r, restaurant: rest } = confirmation;
    return (
      <div className="min-h-screen bg-[#eef0f4] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200/60 p-6 sm:p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">You&apos;re all set!</h1>
            <p className="text-sm text-slate-500">
              Your reservation at {rest.name} is confirmed.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Guest</span>
              <span className="text-sm font-semibold text-slate-900">{r.guestName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Party size</span>
              <span className="text-sm font-semibold text-slate-900">{r.partySize} guest{r.partySize !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Date</span>
              <span className="text-sm font-semibold text-slate-900">{formatDateDisplay(r.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Time</span>
              <span className="text-sm font-semibold text-slate-900">{formatTime12h(r.time)}</span>
            </div>
            {r.sectionName && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Area</span>
                <span className="text-sm font-semibold text-slate-900">{r.sectionName}</span>
              </div>
            )}
            {r.specialRequests && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Notes</span>
                <span className="text-sm font-semibold text-slate-900 text-right max-w-[200px]">{r.specialRequests}</span>
              </div>
            )}
          </div>

          {rest.address && (
            <div className="text-center mb-4">
              <p className="text-xs text-slate-400 mb-1">📍 Location</p>
              <p className="text-sm text-slate-600">{rest.address}</p>
            </div>
          )}

          {rest.phone && (
            <div className="text-center mb-6">
              <p className="text-xs text-slate-400 mb-1">Need to make changes?</p>
              <a href={`tel:${rest.phone}`} className="text-sm font-medium text-blue-600 hover:text-blue-800 transition">
                Call {rest.phone}
              </a>
            </div>
          )}

          <button
            onClick={() => {
              setStep("size");
              setPartySize(2);
              setSelectedDate(localDateStr(new Date()));
              setSelectedTime(null);
              setGuestName("");
              setPhone("");
              setSpecialRequests("");
              setConfirmation(null);
              setSubmitError(null);
            }}
            className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-medium"
          >
            Make Another Reservation
          </button>
        </div>
      </div>
    );
  }

  // Main booking flow
  const availableSlots = slots.filter((s) => s.available);
  const today = localDateStr(new Date());

  return (
    <div className="min-h-screen bg-[#eef0f4]">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-4 text-center">
          <h1 className="text-lg font-bold text-slate-900">{restaurant.name}</h1>
          {restaurant.address && (
            <p className="text-xs text-slate-400 mt-0.5">{restaurant.address}</p>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {["size", "datetime", "details"].map((s, i) => {
            const stepOrder = ["size", "datetime", "details"];
            const currentIdx = stepOrder.indexOf(step);
            const isActive = i === currentIdx;
            const isDone = i < currentIdx;
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : isDone
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {isDone ? "✓" : i + 1}
                </div>
                {i < 2 && (
                  <div className={`w-8 h-0.5 ${isDone ? "bg-emerald-500" : "bg-slate-200"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Party Size */}
        {step === "size" && (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-1">How many guests?</h2>
            <p className="text-sm text-slate-400 mb-6">Select your party size</p>

            <div className="grid grid-cols-4 gap-2 mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => setPartySize(n)}
                  className={`py-3 rounded-xl text-sm font-bold transition ${
                    partySize === n
                      ? "bg-slate-900 text-white"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {restaurant.maxCapacity > 8 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Larger party
                </label>
                <select
                  value={partySize > 8 ? partySize : ""}
                  onChange={(e) => {
                    if (e.target.value) setPartySize(parseInt(e.target.value));
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                >
                  <option value="">9+ guests...</option>
                  {Array.from({ length: Math.min(restaurant.maxCapacity, 20) - 8 }, (_, i) => i + 9).map(
                    (n) => (
                      <option key={n} value={n}>
                        {n} guests
                      </option>
                    )
                  )}
                </select>
              </div>
            )}

            <button
              onClick={() => setStep("datetime")}
              className="w-full py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition text-sm font-semibold"
            >
              Continue · {partySize} guest{partySize !== 1 ? "s" : ""}
            </button>
          </div>
        )}

        {/* Step 2: Date & Time */}
        {step === "datetime" && (
          <div className="space-y-4">
            {/* Date picker */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-1">Pick a date</h2>
              <p className="text-sm text-slate-400 mb-4">
                {partySize} guest{partySize !== 1 ? "s" : ""}
                <button onClick={() => setStep("size")} className="text-blue-600 hover:text-blue-800 ml-2 font-medium">
                  Change
                </button>
              </p>

              {/* Quick date buttons */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() + i);
                  const dateStr = localDateStr(d);
                  const isSelected = dateStr === selectedDate;
                  const dayLabel =
                    i === 0 ? "Today" : i === 1 ? "Tmrw" : d.toLocaleDateString("en-US", { weekday: "short" });
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`flex flex-col items-center px-3 py-2 rounded-xl transition min-w-[52px] flex-shrink-0 ${
                        isSelected
                          ? "bg-slate-900 text-white"
                          : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200/60"
                      }`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide">{dayLabel}</span>
                      <span className={`text-lg font-bold ${isSelected ? "text-white" : "text-slate-700"}`}>
                        {d.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Calendar */}
              {(() => {
                const { year, month } = calendarMonth;
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const monthName = new Date(year, month).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                });
                const days: (number | null)[] = [];
                for (let i = 0; i < firstDay; i++) days.push(null);
                for (let i = 1; i <= daysInMonth; i++) days.push(i);
                return (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() =>
                          setCalendarMonth(
                            month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
                          )
                        }
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-500"
                      >
                        ‹
                      </button>
                      <h3 className="text-sm font-bold text-slate-900">{monthName}</h3>
                      <button
                        onClick={() =>
                          setCalendarMonth(
                            month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
                          )
                        }
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-500"
                      >
                        ›
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 mb-1">
                      {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                        <div key={i} className="text-center text-[10px] font-semibold text-slate-400 uppercase py-1">
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {days.map((day, i) => {
                        if (day === null) return <div key={`e${i}`} />;
                        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const isSelected = dateStr === selectedDate;
                        const isPast = dateStr < today;
                        const isToday = dateStr === today;
                        return (
                          <button
                            key={dateStr}
                            onClick={() => !isPast && setSelectedDate(dateStr)}
                            disabled={isPast}
                            className={`h-9 rounded-lg text-xs font-medium transition ${
                              isPast
                                ? "text-slate-300 cursor-not-allowed"
                                : isSelected
                                ? "bg-slate-900 text-white"
                                : isToday
                                ? "bg-blue-50 text-blue-700 font-bold hover:bg-blue-100"
                                : "text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Time slots */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-1">Pick a time</h2>
              <p className="text-sm text-slate-400 mb-4">{formatDateDisplay(selectedDate)}</p>

              {slotsLoading ? (
                <div className="py-8 text-center">
                  <div className="animate-pulse text-slate-400 text-sm">Checking availability...</div>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="text-2xl mb-2">😔</div>
                  <p className="text-sm text-slate-500 font-medium">No availability for this date</p>
                  <p className="text-xs text-slate-400 mt-1">Try a different date or party size</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => slot.available && setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={`py-2.5 rounded-xl text-sm font-medium transition ${
                        !slot.available
                          ? "bg-slate-50 text-slate-300 cursor-not-allowed line-through"
                          : selectedTime === slot.time
                          ? "bg-slate-900 text-white"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/60"
                      }`}
                    >
                      {formatTime12h(slot.time)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep("size")}
                className="flex-1 py-3 bg-white text-slate-600 border border-slate-200/60 rounded-xl hover:bg-slate-50 transition text-sm font-medium"
              >
                Back
              </button>
              <button
                onClick={() => selectedTime && setStep("details")}
                disabled={!selectedTime}
                className="flex-1 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue · {selectedTime ? formatTime12h(selectedTime) : "Select a time"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Guest Details */}
        {step === "details" && (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Your details</h2>
            <p className="text-sm text-slate-400 mb-6">
              {partySize} guest{partySize !== 1 ? "s" : ""} · {formatDateDisplay(selectedDate)} ·{" "}
              {selectedTime && formatTime12h(selectedTime)}
              <button onClick={() => setStep("datetime")} className="text-blue-600 hover:text-blue-800 ml-2 font-medium">
                Change
              </button>
            </p>

            {submitError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {submitError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Name *</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Your name"
                  maxLength={100}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                />
                <p className="text-xs text-slate-400 mt-1">
                  So the restaurant can reach you if needed
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Special requests</label>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Allergies, celebrations, seating preferences..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep("datetime")}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-medium"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !guestName.trim()}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Booking..." : "Confirm Reservation"}
              </button>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-slate-400 space-y-1">
          <p>
            Open {formatTime12h(restaurant.openTime)} – {formatTime12h(restaurant.closeTime)}
            {restaurant.phone && (
              <span>
                {" · "}
                <a href={`tel:${restaurant.phone}`} className="text-blue-500 hover:text-blue-700">
                  {restaurant.phone}
                </a>
              </span>
            )}
          </p>
          <p>
            Powered by{" "}
            <a
              href="https://www.mesacall.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-500 hover:text-slate-700"
            >
              Mesa
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
