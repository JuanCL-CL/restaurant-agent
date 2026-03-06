"use client";

import { useState, useEffect, use } from "react";
import FloorplanCanvas from "@/components/FloorplanCanvas";
import RestaurantSwitcher from "@/components/RestaurantSwitcher";
import UserMenu from "@/components/UserMenu";

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

interface Table {
  id: string;
  name: string;
  capacity: number;
  section_id: string;
  section_name?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

interface Section {
  id: string;
  name: string;
  description?: string;
  display_order: number;
}

export default function Dashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    fetchReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, slug]);

  async function fetchReservations() {
    setLoading(true);
    try {
      const res = await fetch(`/api/r/${slug}/reservations?date=${selectedDate}`);
      const data = await res.json();
      setReservations(data.reservations || []);
      setTables(data.tables || []);
      setSections(data.sections || []);
      setSelectedSectionId((prev) => prev ?? (data.sections?.[0]?.id ?? null));
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
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
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

  const reservationsByTableId = reservations.reduce((acc, r) => {
    if (!acc[r.table_id]) acc[r.table_id] = [];
    acc[r.table_id].push(r);
    return acc;
  }, {} as Record<string, Reservation[]>);

  const tableNameById = tables.reduce((acc, t) => {
    acc[t.id] = t.name;
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="min-h-screen bg-[#eef0f4]">
      <header className="bg-[#ffffff]/95 backdrop-blur-md border-b border-slate-200/60 sm:fixed sm:top-0 sm:left-0 sm:right-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <RestaurantSwitcher currentSlug={slug} />
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-sm text-slate-500">Agent Active</span>
            </div>
            <a href={`/r/${slug}/settings`} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition text-sm font-medium">
              ⚙️ <span className="hidden sm:inline">Settings</span>
            </a>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:pt-24">
        {/* Date Navigation */}
        <div className="bg-white rounded-2xl border border-slate-200/60 p-4 sm:p-6 mb-4 sm:mb-8">
          <div className="flex items-center justify-between">
            <button onClick={() => shiftDate(-1)} className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition text-slate-500 text-lg font-medium">‹</button>
            <div className="flex-1 text-center min-w-0">
              <h2 className="text-xl sm:text-3xl font-bold text-slate-900 mb-1">{formatDateDisplay(selectedDate)}</h2>
              <p className="text-xs sm:text-sm text-slate-400 mb-3">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 justify-start sm:justify-center">
                {[-1, 0, 1, 2, 3, 4, 5, 6].map((offset) => {
                  const d = new Date(); d.setDate(d.getDate() + offset);
                  const dateStr = d.toISOString().split("T")[0];
                  const isSelected = dateStr === selectedDate;
                  const dayLabel = offset === 0 ? "Today" : offset === 1 ? "Tmrw" : d.toLocaleDateString("en-US", { weekday: "short" });
                  return (
                    <button key={offset} onClick={() => setSelectedDate(dateStr)}
                      className={`flex flex-col items-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl transition min-w-[44px] sm:min-w-[52px] flex-shrink-0 ${isSelected ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
                      <span className="text-[10px] font-semibold uppercase tracking-wide">{dayLabel}</span>
                      <span className={`text-lg font-bold ${isSelected ? "text-white" : "text-slate-700"}`}>{d.getDate()}</span>
                    </button>
                  );
                })}
                <button onClick={() => { const d = new Date(selectedDate + "T12:00:00"); setCalendarMonth({ year: d.getFullYear(), month: d.getMonth() }); setCalendarOpen(!calendarOpen); }}
                  className={`flex flex-col items-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl transition min-w-[44px] sm:min-w-[52px] flex-shrink-0 cursor-pointer ${calendarOpen ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`}>
                  <span className="text-[10px] font-semibold uppercase tracking-wide">More</span>
                  <span className="text-lg font-bold">📅</span>
                </button>
              </div>
            </div>
            <button onClick={() => shiftDate(1)} className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition text-slate-500 text-lg font-medium">›</button>
          </div>

          {calendarOpen && (() => {
            const { year, month } = calendarMonth;
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const monthName = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
            const days: (number | null)[] = [];
            for (let i = 0; i < firstDay; i++) days.push(null);
            for (let i = 1; i <= daysInMonth; i++) days.push(i);
            return (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="max-w-sm mx-auto">
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setCalendarMonth(month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 transition text-slate-500 font-medium">‹</button>
                    <h3 className="text-lg font-bold text-slate-900">{monthName}</h3>
                    <button onClick={() => setCalendarMonth(month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 transition text-slate-500 font-medium">›</button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (<div key={d} className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wide py-1">{d}</div>))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {days.map((day, i) => {
                      if (day === null) return <div key={`e${i}`} />;
                      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const isSelected = dateStr === selectedDate;
                      const isToday = dateStr === new Date().toISOString().split("T")[0];
                      return (<button key={dateStr} onClick={() => { setSelectedDate(dateStr); setCalendarOpen(false); }}
                        className={`h-10 rounded-lg text-sm font-medium transition ${isSelected ? "bg-slate-900 text-white" : isToday ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700 hover:bg-slate-100"}`}>{day}</button>);
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-8">
          {[{ icon: "📋", val: reservations.length, label: "Reservations", bg: "bg-blue-50" },
            { icon: "👥", val: totalGuests, label: "Total Guests", bg: "bg-emerald-50" },
            { icon: "🪑", val: sortedSlots.length, label: "Time Slots", bg: "bg-amber-50" },
            { icon: "📞", val: "—", label: "Calls Today", bg: "bg-purple-50" }].map(({ icon, val, label, bg }) => (
            <div key={label} className="bg-[#ffffff] rounded-2xl p-5 border border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center text-lg`}>{icon}</div>
                <div><p className="text-2xl font-bold text-slate-900">{val}</p><p className="text-xs text-slate-400">{label}</p></div>
              </div>
            </div>
          ))}
        </div>

        {/* Floorplan */}
        <div className="bg-[#ffffff] rounded-2xl border border-slate-200/60 p-4 sm:p-6 mb-4 sm:mb-8">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div><h3 className="text-base sm:text-lg font-semibold text-slate-900">Floorplan</h3><p className="text-xs sm:text-sm text-slate-400">Tap a table to see its reservations for {formatDateDisplay(selectedDate)}</p></div>
            <div className="text-xs sm:text-sm text-slate-400">{tables.length} table{tables.length !== 1 ? "s" : ""}</div>
          </div>
          {loading ? (<div className="py-10 text-center text-slate-400">Loading floorplan…</div>)
            : tables.length === 0 ? (<div className="py-10 text-center"><div className="text-slate-500 font-medium">No tables configured yet</div><div className="text-slate-400 text-sm mt-1">Add sections/tables in Settings.</div></div>)
            : sections.length === 0 ? (<div className="py-10 text-center"><div className="text-slate-500 font-medium">No sections found</div></div>)
            : (<div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4">
                  {sections.slice().sort((a, b) => a.display_order - b.display_order).map((s) => {
                    const active = (selectedSectionId ?? sections[0]?.id) === s.id;
                    return (<button key={s.id} onClick={() => setSelectedSectionId(s.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition whitespace-nowrap ${active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200/60 hover:bg-slate-50"}`}>{s.name}</button>);
                  })}
                </div>
                <FloorplanCanvas tables={tables.filter((t) => t.section_id === (selectedSectionId ?? sections[0]?.id))} reservationsByTableId={reservationsByTableId} editable={false} heightPx={460} />
                <div className="mt-3 text-xs text-slate-400">Layout is configured per section in Settings → Floorplan Editor.</div>
              </div>)}
        </div>

        {/* Timeline */}
        {loading ? (<div className="bg-[#ffffff] rounded-2xl border border-slate-200/60 p-16 text-center"><div className="animate-pulse text-slate-400 text-lg">Loading reservations...</div></div>)
          : reservations.length === 0 ? (<div className="bg-[#ffffff] rounded-2xl border border-slate-200/60 p-16 text-center"><div className="text-5xl mb-4">📭</div><p className="text-slate-500 text-lg font-medium">No reservations for {formatDateDisplay(selectedDate)}</p><p className="text-slate-400 text-sm mt-1">Reservations made via phone will appear here automatically</p></div>)
          : (<div className="space-y-6">
              {sortedSlots.map((time) => (
                <div key={time}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-sm font-bold">{formatTime(time)}</div>
                    <div className="flex-1 h-px bg-slate-100"></div>
                    <span className="text-sm text-slate-400">{timeSlots[time].length} reservation{timeSlots[time].length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ml-2">
                    {timeSlots[time].map((r) => (
                      <div key={r.id} className="bg-[#ffffff] rounded-xl border border-slate-200/60 hover:border-slate-200 transition-all p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div><h3 className="font-semibold text-slate-900 text-lg">{r.guest_name}</h3><span className="text-sm text-slate-500">👥 {r.party_size} guest{r.party_size !== 1 ? "s" : ""}</span></div>
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">Confirmed</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {r.section_name && <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500">📍 {r.section_name}</span>}
                          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500">🪑 {tableNameById[r.table_id] || r.table_id}</span>
                          {r.special_requests && <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">⚠️ {r.special_requests}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>)}
      </main>
    </div>
  );
}
