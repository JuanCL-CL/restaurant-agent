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
  extra_table_ids?: string | null;
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

/** Get local YYYY-MM-DD string (avoids UTC shift from toISOString) */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Dashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
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
    setSelectedDate(localDateStr(d));
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
    // Primary table
    if (!acc[r.table_id]) acc[r.table_id] = [];
    acc[r.table_id].push(r);
    // Extra tables (combined reservations)
    if (r.extra_table_ids) {
      for (const extraId of r.extra_table_ids.split(",")) {
        if (!acc[extraId]) acc[extraId] = [];
        acc[extraId].push(r);
      }
    }
    return acc;
  }, {} as Record<string, Reservation[]>);

  const tableNameById = tables.reduce((acc, t) => {
    acc[t.id] = t.name;
    return acc;
  }, {} as Record<string, string>);

  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [editForm, setEditForm] = useState({ guest_name: "", party_size: 0, time: "", special_requests: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);

  // Add reservation state
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ guest_name: "", party_size: 2, date: "", time: "19:00", phone: "", special_requests: "", section: "" });
  const [addSelectedTables, setAddSelectedTables] = useState<{ id: string; name: string; capacity: number }[]>([]);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  function openAdd() {
    setAddForm({ guest_name: "", party_size: 2, date: selectedDate, time: "19:00", phone: "", special_requests: "", section: "" });
    setAddSelectedTables([]);
    setAddError(null);
    setAddOpen(true);
  }

  async function submitAdd() {
    if (!addForm.guest_name.trim() || !addForm.date || !addForm.time) {
      setAddError("Please fill in name, date, and time.");
      return;
    }
    setAddSaving(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/r/${slug}/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: addForm.guest_name.trim(),
          partySize: addForm.party_size,
          date: addForm.date,
          time: addForm.time,
          phone: addForm.phone.trim() || undefined,
          specialRequests: addForm.special_requests.trim() || undefined,
          section: addSelectedTables.length > 0 ? undefined : (sections.find((s) => s.id === addForm.section)?.name || undefined),
          tableIds: addSelectedTables.length > 0 ? addSelectedTables.map(t => t.id) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddOpen(false);
        fetchReservations();
      } else {
        setAddError(data.error || "Failed to create reservation");
      }
    } catch (err) {
      setAddError("Network error: " + String(err));
    }
    setAddSaving(false);
  }

  function openEdit(r: Reservation) {
    setEditForm({ guest_name: r.guest_name, party_size: r.party_size, time: r.time, special_requests: r.special_requests || "" });
    setEditingRes(r);
  }

  async function saveEdit() {
    if (!editingRes) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/r/${slug}/reservations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: editingRes.id,
          guestName: editForm.guest_name,
          partySize: editForm.party_size,
          time: editForm.time,
          specialRequests: editForm.special_requests,
        }),
      });
      if (res.ok) {
        setEditingRes(null);
        fetchReservations();
      }
    } catch (err) {
      console.error("Failed to update reservation:", err);
    }
    setEditSaving(false);
  }

  async function cancelRes(id: string) {
    try {
      const res = await fetch(`/api/r/${slug}/reservations`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: id }),
      });
      if (res.ok) {
        setCancelConfirm(null);
        fetchReservations();
      }
    } catch (err) {
      console.error("Failed to cancel reservation:", err);
    }
  }

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
            <a href={`/r/${slug}/calls`} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition text-sm font-medium">
              📞 <span className="hidden sm:inline">Calls</span>
            </a>
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
                  const dateStr = localDateStr(d);
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
                      const isToday = dateStr === localDateStr(new Date());
                      return (<button key={dateStr} onClick={() => { setSelectedDate(dateStr); setCalendarOpen(false); }}
                        className={`h-10 rounded-lg text-sm font-medium transition ${isSelected ? "bg-slate-900 text-white" : isToday ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700 hover:bg-slate-100"}`}>{day}</button>);
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Add Reservation Button */}
        <div className="flex justify-end mb-3 sm:mb-4">
          <button onClick={openAdd} className="px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition text-sm font-semibold flex items-center gap-2 shadow-sm">
            <span className="text-lg leading-none">+</span> Add Reservation
          </button>
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
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${r.status === "cancelled" ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
                              {r.status === "cancelled" ? "Cancelled" : "Confirmed"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          {r.section_name && <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500">📍 {r.section_name}</span>}
                          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500">🪑 {[r.table_id, ...(r.extra_table_ids ? r.extra_table_ids.split(",") : [])].map(id => tableNameById[id] || id).join(" + ")}</span>
                          {r.special_requests && <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">🎂 {r.special_requests}</span>}
                        </div>
                        {r.status !== "cancelled" && (
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                            <button onClick={() => openEdit(r)} className="text-xs font-medium text-blue-600 hover:text-blue-800 transition px-2 py-1 rounded-lg hover:bg-blue-50">✏️ Edit</button>
                            <button onClick={() => setCancelConfirm(r.id)} className="text-xs font-medium text-red-500 hover:text-red-700 transition px-2 py-1 rounded-lg hover:bg-red-50">✕ Cancel</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>)}
      </main>

      {/* Edit Reservation Modal */}
      {editingRes && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingRes(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Edit Reservation</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Guest Name</label>
                <input type="text" value={editForm.guest_name} onChange={(e) => setEditForm({ ...editForm, guest_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Party Size</label>
                  <select value={editForm.party_size} onChange={(e) => setEditForm({ ...editForm, party_size: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    {[1,2,3,4,5,6,7,8,9,10,12,15,20].map((n) => <option key={n} value={n}>{n} guest{n !== 1 ? "s" : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Time</label>
                  <input type="time" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Special Requests</label>
                <input type="text" value={editForm.special_requests} onChange={(e) => setEditForm({ ...editForm, special_requests: e.target.value })}
                  placeholder="Allergies, celebrations, etc."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingRes(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition">Cancel</button>
              <button onClick={saveEdit} disabled={editSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCancelConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Cancel Reservation?</h2>
            <p className="text-sm text-slate-500 mb-6">This will cancel the reservation. The guest won&apos;t be automatically notified.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCancelConfirm(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition">Keep It</button>
              <button onClick={() => cancelRes(cancelConfirm)} className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition">Cancel Reservation</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Reservation Modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Add Reservation</h2>
            {addError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{addError}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Guest Name *</label>
                <input type="text" value={addForm.guest_name} onChange={(e) => setAddForm({ ...addForm, guest_name: e.target.value })}
                  placeholder="John Smith"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Party Size *</label>
                <select value={addForm.party_size} onChange={(e) => setAddForm({ ...addForm, party_size: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                  {[1,2,3,4,5,6,7,8,9,10,12,15,20].map((n) => <option key={n} value={n}>{n} guest{n !== 1 ? "s" : ""}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-600">Table</label>
                  {addSelectedTables.length > 0 && (
                    <button onClick={() => setAddSelectedTables([])}
                      className="text-xs text-slate-400 hover:text-slate-600">
                      Clear
                    </button>
                  )}
                </div>
                {addSelectedTables.length > 0 && (() => {
                  const totalSeats = addSelectedTables.reduce((s, t) => s + t.capacity, 0);
                  const fits = totalSeats >= addForm.party_size;
                  return (
                    <div className={`mb-2 px-3 py-2 rounded-xl text-sm border ${fits ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                      {addSelectedTables.map(t => t.name).join(" + ")} · {totalSeats} seats {!fits && <span className="font-medium">(need {addForm.party_size})</span>}
                    </div>
                  );
                })()}
                {sections.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2">
                    {sections.slice().sort((a, b) => a.display_order - b.display_order).map((s) => {
                      const sectionId = addForm.section || sections[0]?.id;
                      const active = sectionId === s.id;
                      return (
                        <button key={s.id} onClick={() => setAddForm({ ...addForm, section: s.id })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition whitespace-nowrap ${active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <FloorplanCanvas
                  tables={tables.filter((t) => t.section_id === (addForm.section || sections[0]?.id))}
                  reservationsByTableId={reservationsByTableId}
                  selectable
                  selectedIds={addSelectedTables.map(t => t.id)}
                  onSelect={(id, t) => {
                    setAddSelectedTables(prev => {
                      const exists = prev.find(s => s.id === id);
                      if (exists) return prev.filter(s => s.id !== id);
                      return [...prev, { id, name: t.name, capacity: t.capacity }];
                    });
                  }}
                  heightPx={280}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Date *</label>
                  <input type="date" value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Time *</label>
                  <input type="time" value={addForm.time} onChange={(e) => setAddForm({ ...addForm, time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Phone</label>
                <input type="tel" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Special Requests</label>
                <input type="text" value={addForm.special_requests} onChange={(e) => setAddForm({ ...addForm, special_requests: e.target.value })}
                  placeholder="Allergies, celebrations, seating preference..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition">Cancel</button>
              <button onClick={submitAdd} disabled={addSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-50">
                {addSaving ? "Booking…" : "Book Reservation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
