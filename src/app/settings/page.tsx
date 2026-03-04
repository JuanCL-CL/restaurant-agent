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
  const [newTable, setNewTable] = useState({ name: "", capacity: 2, section_id: "" });
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
      showMessage("Settings saved!");
    } catch {
      showMessage("Failed to save");
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
        showMessage(`"${data.section.name}" section added!`);
      }
    } catch {
      showMessage("Failed to add section");
    }
  }

  async function removeSection(id: string) {
    if (!confirm("Delete this section and all its tables?")) return;
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_section", id }),
      });
      setSections(sections.filter((s) => s.id !== id));
      setTables(tables.filter((t) => t.section_id !== id));
      showMessage("Section deleted");
    } catch {
      showMessage("Failed to delete");
    }
  }

  async function addTable() {
    if (!newTable.name.trim() || !newTable.section_id) return;
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_table", ...newTable }),
      });
      const data = await res.json();
      if (data.table) {
        setTables([...tables, data.table]);
        setNewTable({ name: "", capacity: 2, section_id: newTable.section_id });
        showMessage(`"${data.table.name}" added!`);
      }
    } catch {
      showMessage("Failed to add table");
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
      showMessage("Table removed");
    } catch {
      showMessage("Failed to remove");
    }
  }

  function showMessage(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">⚙️ Restaurant Settings</h1>
            <p className="text-sm text-gray-500">Customize your layout and preferences</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      {message && (
        <div className="max-w-4xl mx-auto px-6 mt-4">
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">
            {message}
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Restaurant Info */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Restaurant Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant Name</label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={settings.phone || ""}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-gray-900"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={settings.address || ""}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-gray-900"
              />
            </div>
          </div>

          <h3 className="text-md font-medium text-gray-900 mt-6 mb-3">Hours & Reservations</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opens</label>
              <input
                type="time"
                value={settings.open_time}
                onChange={(e) => setSettings({ ...settings, open_time: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Closes</label>
              <input
                type="time"
                value={settings.close_time}
                onChange={(e) => setSettings({ ...settings, close_time: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Seating</label>
              <input
                type="time"
                value={settings.last_seating}
                onChange={(e) => setSettings({ ...settings, last_seating: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reservation Duration (min)</label>
              <input
                type="number"
                value={settings.reservation_duration_minutes}
                onChange={(e) => setSettings({ ...settings, reservation_duration_minutes: parseInt(e.target.value) || 90 })}
                className="w-full border rounded-lg px-3 py-2 text-gray-900"
              />
            </div>
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        {/* Sections & Tables */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Seating Layout</h2>
          <p className="text-sm text-gray-500 mb-6">
            Define sections and tables. The AI uses this to check availability and seat callers.
          </p>

          <div className="space-y-4 mb-6">
            {sections.map((section) => {
              const sectionTables = tables.filter((t) => t.section_id === section.id);
              return (
                <div key={section.id} className="border rounded-xl overflow-hidden">
                  {/* Section header */}
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{section.name}</p>
                      {section.description && <p className="text-xs text-gray-500">{section.description}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {sectionTables.length} table{sectionTables.length !== 1 ? "s" : ""} · {sectionTables.reduce((s, t) => s + t.capacity, 0)} seats
                      </span>
                      <button
                        onClick={() => removeSection(section.id)}
                        className="text-red-400 hover:text-red-600 text-xs font-medium"
                      >
                        Delete Section
                      </button>
                    </div>
                  </div>

                  {/* Tables in this section */}
                  <div className="p-4">
                    {sectionTables.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No tables yet — add one below</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
                        {sectionTables.map((table) => (
                          <div key={table.id} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2 group">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{table.name}</span>
                              <span className="text-xs text-gray-400">({table.capacity} seats)</span>
                            </div>
                            <button
                              onClick={() => removeTable(table.id)}
                              className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quick add table to this section */}
                    <div className="flex gap-2 pt-2 border-t border-dashed">
                      <input
                        type="text"
                        placeholder={`New table name (e.g., ${section.name} ${sectionTables.length + 1})`}
                        id={`new-table-name-${section.id}`}
                        className="flex-1 border rounded-lg px-3 py-1.5 text-sm text-gray-900"
                      />
                      <input
                        type="number"
                        placeholder="Seats"
                        defaultValue={4}
                        id={`new-table-cap-${section.id}`}
                        className="w-20 border rounded-lg px-3 py-1.5 text-sm text-gray-900"
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
                              showMessage(`"${name}" added to ${section.name}!`);
                            }
                          } catch { showMessage("Failed to add table"); }
                        }}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add new section */}
          <div className="pt-4 border-t">
            <p className="text-sm font-medium text-gray-700 mb-2">Add New Section</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Section name (e.g., Upstairs, Rooftop)"
                value={newSection.name}
                onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
                className="flex-1 border rounded-lg px-3 py-2 text-sm text-gray-900"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newSection.description}
                onChange={(e) => setNewSection({ ...newSection, description: e.target.value })}
                className="flex-1 border rounded-lg px-3 py-2 text-sm text-gray-900"
              />
              <button
                onClick={addSection}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium whitespace-nowrap"
              >
                + Add Section
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
