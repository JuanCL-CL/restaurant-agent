"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    name: "",
    open_time: "11:00",
    close_time: "22:00",
    last_seating: "21:30",
    reservation_duration_minutes: 90,
  });
  const [sections, setSections] = useState<Section[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSection, setNewSection] = useState({ name: "", description: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
      if (data.sections) setSections(data.sections);
      if (data.tables) setTables(data.tables);
    } catch {
      console.error("Failed to load settings");
    }
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
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
      const res = await fetch("/api/settings", {
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
      await fetch("/api/settings", {
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
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_table", id }),
      });
      setTables(tables.filter((t) => t.id !== id));
    } catch {
      showMessage("❌ Failed to remove table");
    }
  }

  function showMessage(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  }

  const totalTables = tables.length;
  const totalSeats = tables.reduce((s, t) => s + t.capacity, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="animate-pulse text-slate-400 text-lg">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">⚙️ Settings</h1>
            <p className="text-sm text-slate-500">Configure your restaurant</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition text-sm font-medium"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      {/* Toast */}
      {message && (
        <div className="fixed top-20 right-6 z-50 animate-fade-in">
          <div className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
            {message}
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/50 text-center">
            <p className="text-3xl font-bold text-slate-900">{sections.length}</p>
            <p className="text-xs text-slate-500 mt-1">Sections</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/50 text-center">
            <p className="text-3xl font-bold text-slate-900">{totalTables}</p>
            <p className="text-xs text-slate-500 mt-1">Tables</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/50 text-center">
            <p className="text-3xl font-bold text-slate-900">{totalSeats}</p>
            <p className="text-xs text-slate-500 mt-1">Total Seats</p>
          </div>
        </div>

        {/* Restaurant Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b">
            <h2 className="text-lg font-semibold text-slate-900">🏪 Restaurant Info</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Restaurant Name</label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Marco's Italian Kitchen"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Phone Number</label>
                <input
                  type="text"
                  value={settings.phone || ""}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Address</label>
                <input
                  type="text"
                  value={settings.address || ""}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="123 Main St, New York, NY 10001"
                />
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Hours</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Opens</label>
                  <input
                    type="time"
                    value={settings.open_time}
                    onChange={(e) => setSettings({ ...settings, open_time: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Closes</label>
                  <input
                    type="time"
                    value={settings.close_time}
                    onChange={(e) => setSettings({ ...settings, close_time: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Last Seating</label>
                  <input
                    type="time"
                    value={settings.last_seating}
                    onChange={(e) => setSettings({ ...settings, last_seating: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium disabled:opacity-50 shadow-sm"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>

        {/* Seating Layout */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">🪑 Seating Layout</h2>
            <p className="text-sm text-slate-500">{totalTables} tables · {totalSeats} seats</p>
          </div>
          <div className="p-6">
            {/* Sections */}
            <div className="space-y-5 mb-8">
              {sections.map((section) => {
                const sectionTables = tables.filter((t) => t.section_id === section.id);
                const sectionSeats = sectionTables.reduce((s, t) => s + t.capacity, 0);
                return (
                  <div key={section.id} className="rounded-xl border border-slate-200 overflow-hidden">
                    {/* Section header */}
                    <div className="bg-gradient-to-r from-slate-50 to-white px-5 py-3.5 flex items-center justify-between border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm font-bold">
                          {section.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{section.name}</h3>
                          <p className="text-xs text-slate-500">
                            {sectionTables.length} table{sectionTables.length !== 1 ? "s" : ""} · {sectionSeats} seats
                            {section.description && ` · ${section.description}`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeSection(section.id, section.name)}
                        className="text-xs text-slate-400 hover:text-red-500 transition font-medium px-2 py-1 rounded hover:bg-red-50"
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
                              className="group relative flex items-center gap-2 bg-slate-50 hover:bg-slate-100 rounded-lg px-3 py-2 transition border border-transparent hover:border-slate-200"
                            >
                              <span className="text-sm font-medium text-slate-800">{table.name}</span>
                              <select
                                value={table.capacity}
                                onChange={async (e) => {
                                  const newCap = parseInt(e.target.value);
                                  try {
                                    await fetch("/api/settings", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ action: "update_table", id: table.id, capacity: newCap }),
                                    });
                                    setTables(tables.map((t) => t.id === table.id ? { ...t, capacity: newCap } : t));
                                  } catch { /* ignore */ }
                                }}
                                className="text-xs border-0 bg-white rounded-md px-1.5 py-0.5 text-slate-600 cursor-pointer shadow-sm"
                              >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20].map((n) => (
                                  <option key={n} value={n}>{n} seats</option>
                                ))}
                              </select>
                              <button
                                onClick={() => removeTable(table.id)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Quick add */}
                      <div className="flex gap-2 pt-3 border-t border-dashed border-slate-200">
                        <input
                          type="text"
                          placeholder={`Add table to ${section.name}...`}
                          id={`new-table-name-${section.id}`}
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        />
                        <input
                          type="number"
                          placeholder="Seats"
                          defaultValue={4}
                          id={`new-table-cap-${section.id}`}
                          className="w-20 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        />
                        <button
                          onClick={async () => {
                            const nameEl = document.getElementById(`new-table-name-${section.id}`) as HTMLInputElement;
                            const capEl = document.getElementById(`new-table-cap-${section.id}`) as HTMLInputElement;
                            const name = nameEl?.value?.trim();
                            const capacity = parseInt(capEl?.value) || 4;
                            if (!name) return;
                            try {
                              const res = await fetch("/api/settings", {
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
                          className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition text-sm font-medium"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* New Section */}
            <div className="bg-slate-50 rounded-xl p-5 border border-dashed border-slate-300">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Add New Section</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Section name (e.g., Rooftop, Upstairs)"
                  value={newSection.name}
                  onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addSection()}
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newSection.description}
                  onChange={(e) => setNewSection({ ...newSection, description: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addSection()}
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button
                  onClick={addSection}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition text-sm font-semibold shadow-sm whitespace-nowrap"
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
