"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import FloorplanCanvas from "@/components/FloorplanCanvas";
import RestaurantSwitcher from "@/components/RestaurantSwitcher";
import UserMenu from "@/components/UserMenu";

interface Section {
  id: string;
  name: string;
  description?: string;
  display_order: number;
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

interface Settings {
  name: string;
  phone?: string;
  address?: string;
  open_time: string;
  close_time: string;
  last_seating: string;
  reservation_duration_minutes: number;
}

export default function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [settings, setSettings] = useState<Settings>({
    name: "",
    open_time: "11:00",
    close_time: "22:00",
    last_seating: "21:30",
    reservation_duration_minutes: 90,
  });
  const [sections, setSections] = useState<Section[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [restaurantInfo, setRestaurantInfo] = useState<{ vapi_assistant_id?: string; twilio_phone?: string } | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<Array<{ sid: string; phoneNumber: string; friendlyName: string; assigned: boolean; assignedToThis: boolean }>>([]);
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [assigningPhone, setAssigningPhone] = useState(false);
  const [floorplanSectionId, setFloorplanSectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [newSection, setNewSection] = useState({ name: "", description: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const res = await fetch(`/api/r/${slug}/settings`);
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
      if (data.sections) {
        setSections(data.sections);
        setFloorplanSectionId((prev) => prev ?? (data.sections?.[0]?.id ?? null));
      }
      if (data.tables) setTables(data.tables);
      if (data.restaurant) setRestaurantInfo(data.restaurant);
    } catch {
      console.error("Failed to load settings");
    }
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await fetch(`/api/r/${slug}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_settings", settings }),
      });
      showMessage("✅ Settings saved!");
    } catch {
      showMessage("❌ Failed to save");
    }
    setSaving(false);
  }

  async function addSection() {
    if (!newSection.name.trim()) return;
    try {
      const res = await fetch(`/api/r/${slug}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_section", ...newSection }),
      });
      const data = await res.json();
      if (data.section) {
        setSections([...sections, data.section]);
        setNewSection({ name: "", description: "" });
        showMessage(`✅ "${data.section.name}" section added!`);
      }
    } catch {
      showMessage("❌ Failed to add section");
    }
  }

  async function removeSection(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its tables?`)) return;
    try {
      await fetch(`/api/r/${slug}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_section", id }),
      });
      setSections(sections.filter((s) => s.id !== id));
      setTables(tables.filter((t) => t.section_id !== id));
      showMessage(`Removed "${name}"`);
    } catch {
      showMessage("❌ Failed to delete");
    }
  }

  async function removeTable(id: string) {
    try {
      await fetch(`/api/r/${slug}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_table", id }),
      });
      setTables(tables.filter((t) => t.id !== id));
    } catch {
      showMessage("❌ Failed to remove table");
    }
  }

  async function saveFloorplanLayout(sectionId: string) {
    setSavingLayout(true);
    try {
      const sectionTables = tables.filter((t) => t.section_id === sectionId);
      await Promise.all(
        sectionTables.map((t) =>
          fetch(`/api/r/${slug}/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "update_table",
              id: t.id,
              x: t.x,
              y: t.y,
              w: t.w,
              h: t.h,
            }),
          })
        )
      );
      showMessage("✅ Floorplan saved!");
    } catch {
      showMessage("❌ Failed to save floorplan");
    }
    setSavingLayout(false);
  }

  function showMessage(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  }

  const totalTables = tables.length;
  const totalSeats = tables.reduce((s, t) => s + t.capacity, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eef0f4] flex items-center justify-center">
        <div className="animate-pulse text-slate-400 text-lg">Loading settings...</div>
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
              <h1 className="text-xl font-bold text-slate-900">⚙️ Settings</h1>
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
          <div className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
            {message}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:pt-24 space-y-4 sm:space-y-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-[#ffffff] rounded-2xl p-3 sm:p-5 border border-slate-200/60 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">{sections.length}</p>
            <p className="text-xs text-slate-400 mt-1">Sections</p>
          </div>
          <div className="bg-[#ffffff] rounded-2xl p-3 sm:p-5 border border-slate-200/60 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">{totalTables}</p>
            <p className="text-xs text-slate-400 mt-1">Tables</p>
          </div>
          <div className="bg-[#ffffff] rounded-2xl p-3 sm:p-5 border border-slate-200/60 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">{totalSeats}</p>
            <p className="text-xs text-slate-400 mt-1">Total Seats</p>
          </div>
        </div>

        {/* Restaurant Info */}
        <div className="bg-[#ffffff] rounded-2xl border border-slate-200/60 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-b border-slate-200/60">
            <h2 className="text-lg font-semibold text-slate-900">🏪 Restaurant Info</h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">Restaurant Name</label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className="w-full bg-[#eef0f4] border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Marco's Italian Kitchen"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">Phone Number</label>
                <input
                  type="text"
                  value={settings.phone || ""}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full bg-[#eef0f4] border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-500 mb-1.5">Address</label>
                <input
                  type="text"
                  value={settings.address || ""}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  className="w-full bg-[#eef0f4] border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="123 Main St, New York, NY 10001"
                />
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200/60">
              <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Hours</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1.5">Opens</label>
                  <input
                    type="time"
                    value={settings.open_time}
                    onChange={(e) => setSettings({ ...settings, open_time: e.target.value })}
                    className="w-full bg-[#eef0f4] border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1.5">Closes</label>
                  <input
                    type="time"
                    value={settings.close_time}
                    onChange={(e) => setSettings({ ...settings, close_time: e.target.value })}
                    className="w-full bg-[#eef0f4] border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1.5">Last Seating</label>
                  <input
                    type="time"
                    value={settings.last_seating}
                    onChange={(e) => setSettings({ ...settings, last_seating: e.target.value })}
                    className="w-full bg-[#eef0f4] border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>

        {/* AI Agent */}
        <div className="bg-[#ffffff] rounded-2xl border border-slate-200/60 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-b border-slate-200/60">
            <h2 className="text-lg font-semibold text-slate-900">🤖 AI Phone Agent</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            {/* Agent status */}
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${restaurantInfo?.vapi_assistant_id ? "bg-emerald-50" : "bg-slate-100"}`}>
                {restaurantInfo?.vapi_assistant_id ? "✅" : "⏳"}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-900">
                  {restaurantInfo?.vapi_assistant_id ? "Agent active" : "No agent configured"}
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {restaurantInfo?.vapi_assistant_id
                    ? "Your AI receptionist is ready to take calls. It greets callers, checks availability, and makes reservations automatically."
                    : "An AI agent will be created when you set up your restaurant."}
                </p>
              </div>
            </div>

            {/* Phone number */}
            <div className="border-t border-slate-200/60 pt-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold text-slate-900">📞 Phone Number</div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {restaurantInfo?.twilio_phone
                      ? "Callers dial this number to reach your AI receptionist."
                      : "Assign a phone number so customers can call your AI agent."}
                  </p>
                </div>
                {restaurantInfo?.twilio_phone && (
                  <span className="text-lg font-mono font-bold text-slate-900">{restaurantInfo.twilio_phone}</span>
                )}
              </div>

              {!restaurantInfo?.twilio_phone && restaurantInfo?.vapi_assistant_id && (
                <div>
                  {phoneNumbers.length === 0 && !loadingPhone ? (
                    <button
                      onClick={async () => {
                        setLoadingPhone(true);
                        try {
                          const res = await fetch(`/api/r/${slug}/phone`);
                          const data = await res.json();
                          setPhoneNumbers(data.numbers || []);
                        } catch { showMessage("❌ Failed to load phone numbers"); }
                        setLoadingPhone(false);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-semibold"
                    >
                      {loadingPhone ? "Loading…" : "Assign phone number"}
                    </button>
                  ) : loadingPhone ? (
                    <div className="text-sm text-slate-400">Loading available numbers…</div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400 mb-2">Available phone numbers:</p>
                      {phoneNumbers.map((n) => (
                        <div key={n.sid} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200/60">
                          <div>
                            <span className="font-mono text-sm font-semibold text-slate-900">{n.friendlyName}</span>
                            <span className="text-xs text-slate-400 ml-2">{n.phoneNumber}</span>
                          </div>
                          {n.assigned && !n.assignedToThis ? (
                            <span className="text-xs text-slate-400">In use</span>
                          ) : (
                            <button
                              onClick={async () => {
                                setAssigningPhone(true);
                                try {
                                  const res = await fetch(`/api/r/${slug}/phone`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ phoneNumber: n.phoneNumber, phoneNumberSid: n.sid }),
                                  });
                                  const data = await res.json();
                                  if (data.success) {
                                    setRestaurantInfo((prev) => prev ? { ...prev, twilio_phone: n.phoneNumber } : prev);
                                    showMessage("✅ Phone number assigned!");
                                  } else {
                                    showMessage(`❌ ${data.error || "Failed"}`);
                                  }
                                } catch { showMessage("❌ Failed to assign number"); }
                                setAssigningPhone(false);
                              }}
                              disabled={assigningPhone}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-xs font-semibold disabled:opacity-50"
                            >
                              {assigningPhone ? "Assigning…" : n.assignedToThis ? "Reassign" : "Use this number"}
                            </button>
                          )}
                        </div>
                      ))}
                      {phoneNumbers.length === 0 && (
                        <div className="text-sm text-slate-400 py-2">No phone numbers found on your Twilio account.</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Call Forwarding Setup Guide */}
        {restaurantInfo?.twilio_phone && (
          <div className="bg-[#ffffff] rounded-2xl border border-slate-200/60 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-b border-slate-200/60">
              <h2 className="text-lg font-semibold text-slate-900">📲 Connect Your Restaurant Phone</h2>
              <p className="text-sm text-slate-400 mt-0.5">One quick step so your AI agent catches missed calls</p>
            </div>
            <div className="p-4 sm:p-6">
              {/* How it works — visual flow */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-5 mb-6">
                <div className="text-sm font-semibold text-blue-900 mb-3">How it works</div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-sm text-blue-800">
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-900">1</span>
                    <span>Customer calls your restaurant</span>
                  </div>
                  <span className="hidden sm:inline text-blue-300">→</span>
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-900">2</span>
                    <span>Nobody picks up</span>
                  </div>
                  <span className="hidden sm:inline text-blue-300">→</span>
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-900">3</span>
                    <span>AI answers &amp; takes the reservation</span>
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-3">
                  Your customers keep calling the same number they always have. You just need to tell your phone carrier to forward missed calls to your AI agent.
                </p>
              </div>

              {/* Your AI agent number */}
              <div className="bg-slate-50 rounded-xl border border-slate-200/60 p-4 mb-6">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Your AI Agent&apos;s Phone Number</div>
                <div className="font-mono text-lg font-bold text-slate-900 tracking-wide">
                  {restaurantInfo.twilio_phone?.replace("+1", "(").replace(/(\d{3})(\d{3})(\d{4})/, "$1) $2-$3")}
                </div>
                <p className="text-xs text-slate-400 mt-1">This is the number your missed calls will be sent to</p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Select your phone carrier, then follow the steps</h3>

                {/* AT&T */}
                <div className="rounded-xl border border-slate-200/60 overflow-hidden">
                  <details className="group">
                    <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition">
                      <span className="font-semibold text-slate-900">AT&T</span>
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="px-4 pb-4 text-sm text-slate-600 space-y-3">
                      <ol className="list-none space-y-3">
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">1</span>
                          <span>Pick up your <strong>restaurant phone</strong> (the one customers call)</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">2</span>
                          <div>
                            <span>Dial this code exactly:</span>
                            <div className="bg-slate-900 rounded-lg p-3 font-mono text-base text-white mt-2 tracking-widest select-all">
                              *61*{restaurantInfo.twilio_phone?.replace("+1", "")}#
                            </div>
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">3</span>
                          <span>You should hear a confirmation tone or message. That&apos;s it — you&apos;re done! ✅</span>
                        </li>
                      </ol>
                      <div className="text-xs text-slate-400 border-t border-slate-100 pt-2 mt-2">
                        To turn off forwarding later, dial <span className="font-mono">##61#</span> from the same phone.
                      </div>
                    </div>
                  </details>
                </div>

                {/* Verizon */}
                <div className="rounded-xl border border-slate-200/60 overflow-hidden">
                  <details className="group">
                    <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition">
                      <span className="font-semibold text-slate-900">Verizon</span>
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="px-4 pb-4 text-sm text-slate-600 space-y-3">
                      <ol className="list-none space-y-3">
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">1</span>
                          <span>Pick up your <strong>restaurant phone</strong> (the one customers call)</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">2</span>
                          <div>
                            <span>Dial this code exactly:</span>
                            <div className="bg-slate-900 rounded-lg p-3 font-mono text-base text-white mt-2 tracking-widest select-all">
                              *71{restaurantInfo.twilio_phone?.replace("+1", "")}
                            </div>
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">3</span>
                          <span>Wait for a confirmation tone or message. That&apos;s it — you&apos;re done! ✅</span>
                        </li>
                      </ol>
                      <div className="text-xs text-slate-400 border-t border-slate-100 pt-2 mt-2">
                        To turn off forwarding later, dial <span className="font-mono">*73</span> from the same phone.
                      </div>
                    </div>
                  </details>
                </div>

                {/* T-Mobile */}
                <div className="rounded-xl border border-slate-200/60 overflow-hidden">
                  <details className="group">
                    <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition">
                      <span className="font-semibold text-slate-900">T-Mobile</span>
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="px-4 pb-4 text-sm text-slate-600 space-y-3">
                      <ol className="list-none space-y-3">
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">1</span>
                          <span>Pick up your <strong>restaurant phone</strong> (the one customers call)</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">2</span>
                          <div>
                            <span>Dial this code exactly:</span>
                            <div className="bg-slate-900 rounded-lg p-3 font-mono text-base text-white mt-2 tracking-widest select-all">
                              **61*+1{restaurantInfo.twilio_phone?.replace("+1", "")}#
                            </div>
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">3</span>
                          <span>Wait for a confirmation tone or message. That&apos;s it — you&apos;re done! ✅</span>
                        </li>
                      </ol>
                      <div className="text-xs text-slate-400 border-t border-slate-100 pt-2 mt-2">
                        To turn off forwarding later, dial <span className="font-mono">##61#</span> from the same phone.
                      </div>
                    </div>
                  </details>
                </div>

                {/* VoIP / Business */}
                <div className="rounded-xl border border-slate-200/60 overflow-hidden">
                  <details className="group">
                    <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition">
                      <span className="font-semibold text-slate-900">VoIP / Business phone system</span>
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="px-4 pb-4 text-sm text-slate-600 space-y-3">
                      <p className="text-slate-500">For systems like RingCentral, Vonage, Google Voice, Ooma, 8x8, etc.</p>
                      <ol className="list-none space-y-3">
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">1</span>
                          <span>Log in to your phone system&apos;s <strong>admin panel</strong> or <strong>settings app</strong></span>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">2</span>
                          <span>Look for <strong>&quot;Call forwarding&quot;</strong>, <strong>&quot;Unanswered calls&quot;</strong>, or <strong>&quot;After hours routing&quot;</strong></span>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">3</span>
                          <div>
                            <span>Set the forward-to number to:</span>
                            <div className="bg-slate-900 rounded-lg p-3 font-mono text-base text-white mt-2 tracking-widest select-all">
                              {restaurantInfo.twilio_phone}
                            </div>
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">4</span>
                          <span>Set the ring timeout to <strong>15–20 seconds</strong> (about 3–4 rings before forwarding)</span>
                        </li>
                      </ol>
                    </div>
                  </details>
                </div>

                {/* Not sure */}
                <div className="rounded-xl border border-slate-200/60 overflow-hidden">
                  <details className="group">
                    <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition">
                      <span className="font-semibold text-slate-900">I&apos;m not sure / Other carrier</span>
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="px-4 pb-4 text-sm text-slate-600 space-y-3">
                      <p>No worries! Just call your phone provider and say:</p>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 italic">
                        &quot;I&apos;d like to set up call forwarding so that when I don&apos;t answer, calls go to a different number.&quot;
                      </div>
                      <div>
                        <span>Then give them this number:</span>
                        <div className="bg-slate-900 rounded-lg p-3 font-mono text-base text-white mt-2 tracking-widest select-all">
                          {restaurantInfo.twilio_phone?.replace("+1", "(").replace(/(\d{3})(\d{3})(\d{4})/, "$1) $2-$3")}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">This is a standard feature every carrier supports — it&apos;s usually free and takes about 2 minutes.</p>
                    </div>
                  </details>
                </div>
              </div>

              {/* Test tip */}
              <div className="mt-5 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
                <strong>✅ Test it:</strong> Call your restaurant number from a different phone, let it ring without answering, and see if the AI picks up. If it does — you&apos;re all set!
              </div>
            </div>
          </div>
        )}

        {/* Floorplan Editor */}
        <div className="bg-[#ffffff] rounded-2xl border border-slate-200/60 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-b border-slate-200/60 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">🗺️ Floorplan Editor</h2>
              <p className="text-sm text-slate-400">Drag tables to position them. Drag the bottom-right corner to resize.</p>
            </div>
            <button
              onClick={() => {
                if (floorplanSectionId) saveFloorplanLayout(floorplanSectionId);
              }}
              disabled={savingLayout || !floorplanSectionId}
              className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-semibold disabled:opacity-50"
            >
              {savingLayout ? "Saving…" : "Save Layout"}
            </button>
          </div>
          <div className="p-4 sm:p-6">
            {sections.length === 0 ? (
              <div className="py-10 text-center text-slate-400">Add a section below first, then arrange tables here.</div>
            ) : (
              <>
                {/* Section tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4">
                  {sections
                    .slice()
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((s) => {
                      const active = (floorplanSectionId ?? sections[0]?.id) === s.id;
                      const count = tables.filter((t) => t.section_id === s.id).length;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setFloorplanSectionId(s.id)}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition whitespace-nowrap ${
                            active
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-600 border-slate-200/60 hover:bg-slate-50"
                          }`}
                        >
                          {s.name} ({count})
                        </button>
                      );
                    })}
                </div>

                {/* Canvas */}
                <FloorplanCanvas
                  tables={tables.filter((t) => t.section_id === (floorplanSectionId ?? sections[0]?.id))}
                  editable={true}
                  heightPx={680}
                  onChange={(updated) => {
                    const otherTables = tables.filter((t) => t.section_id !== (floorplanSectionId ?? sections[0]?.id));
                    setTables([...otherTables, ...updated]);
                  }}
                />
              </>
            )}
          </div>
        </div>

        {/* Seating Layout (table list) */}
        <div className="bg-[#ffffff] rounded-2xl border border-slate-200/60 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-b border-slate-200/60 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">🪑 Seating Layout</h2>
            <p className="text-sm text-slate-400">{totalTables} tables · {totalSeats} seats</p>
          </div>
          <div className="p-4 sm:p-6">
            <div className="space-y-5 mb-8">
              {sections.map((section) => {
                const sectionTables = tables.filter((t) => t.section_id === section.id);
                const sectionSeats = sectionTables.reduce((s, t) => s + t.capacity, 0);
                return (
                  <div key={section.id} className="rounded-xl border border-slate-200/60 overflow-hidden bg-[#eef0f4]">
                    {/* Section header */}
                    <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-200/60 bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm font-bold">
                          {section.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{section.name}</h3>
                          <p className="text-xs text-slate-400">
                            {sectionTables.length} table{sectionTables.length !== 1 ? "s" : ""} · {sectionSeats} seats
                            {section.description && ` · ${section.description}`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeSection(section.id, section.name)}
                        className="text-xs text-slate-400 hover:text-red-400 transition font-medium px-2 py-1 rounded hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>

                    {/* Tables */}
                    <div className="p-4">
                      {sectionTables.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-2">No tables — add one below</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {sectionTables.map((table) => (
                            <div
                              key={table.id}
                              className="group relative flex items-center gap-2 bg-[#ffffff] hover:bg-[#e8eaef] rounded-lg px-3 py-2 transition border border-slate-200/60"
                            >
                              <span className="text-sm font-medium text-slate-600">{table.name}</span>
                              <select
                                value={table.capacity}
                                onChange={async (e) => {
                                  const newCap = parseInt(e.target.value);
                                  try {
                                    await fetch(`/api/r/${slug}/settings`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ action: "update_table", id: table.id, capacity: newCap }),
                                    });
                                    setTables(tables.map((t) => t.id === table.id ? { ...t, capacity: newCap } : t));
                                  } catch { /* ignore */ }
                                }}
                                className="text-xs bg-[#eef0f4] border border-slate-200 rounded-md px-1.5 py-0.5 text-slate-500 cursor-pointer"
                              >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20].map((n) => (
                                  <option key={n} value={n}>{n} seats</option>
                                ))}
                              </select>
                              <button
                                onClick={() => removeTable(table.id)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Quick add */}
                      <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-dashed border-slate-200/60">
                        <input
                          type="text"
                          placeholder={`Add table to ${section.name}...`}
                          id={`new-table-name-${section.id}`}
                          className="flex-1 bg-[#ffffff] border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        />
                        <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Seats"
                          defaultValue={4}
                          id={`new-table-cap-${section.id}`}
                          className="w-20 bg-[#ffffff] border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        />
                        <button
                          onClick={async () => {
                            const nameEl = document.getElementById(`new-table-name-${section.id}`) as HTMLInputElement;
                            const capEl = document.getElementById(`new-table-cap-${section.id}`) as HTMLInputElement;
                            const name = nameEl?.value?.trim();
                            const capacity = parseInt(capEl?.value) || 4;
                            if (!name) return;
                            try {
                              const res = await fetch(`/api/r/${slug}/settings`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "create_table", name, capacity, section_id: section.id }),
                              });
                              const data = await res.json();
                              if (data.table) {
                                setTables([...tables, data.table]);
                                nameEl.value = "";
                                showMessage(`✅ "${name}" added to ${section.name}`);
                              }
                            } catch { showMessage("❌ Failed to add table"); }
                          }}
                          className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-zinc-200 transition text-sm font-bold"
                        >
                          + Add
                        </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* New Section */}
            <div className="bg-[#eef0f4] rounded-xl p-4 sm:p-5 border border-dashed border-slate-200">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">Add New Section</h3>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <input
                  type="text"
                  placeholder="Section name (e.g., Rooftop, Upstairs)"
                  value={newSection.name}
                  onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addSection()}
                  className="flex-1 bg-[#ffffff] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newSection.description}
                  onChange={(e) => setNewSection({ ...newSection, description: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addSection()}
                  className="flex-1 bg-[#ffffff] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button
                  onClick={addSection}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition text-sm font-semibold whitespace-nowrap"
                >
                  + Add Section
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
