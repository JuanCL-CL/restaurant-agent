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

        {/* Sections */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Seating Sections</h2>
          <p className="text-sm text-gray-500 mb-4">
            Define the different areas of your restaurant (e.g., Indoor, Patio, Upstairs, Bar).
            Callers can request a specific section.
          </p>

          <div className="space-y-2 mb-4">
            {sections.map((section) => (
              <div key={section.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">{section.name}</p>
                  {section.description && <p className="text-sm text-gray-500">{section.description}</p>}
                  <p className="text-xs text-gray-400">
                    {tables.filter((t) => t.section_id === section.id).length} tables
                  </p>
                </div>
                <button
                  onClick={() => removeSection(section.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Section name (e.g., Upstairs)"
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

        {/* Tables */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tables</h2>
          <p className="text-sm text-gray-500 mb-4">
            Add each table with its capacity and assign it to a section. The AI will match callers to the right table size.
          </p>

          {sections.map((section) => {
            const sectionTables = tables.filter((t) => t.section_id === section.id);
            return (
              <div key={section.id} className="mb-6">
                <h3 className="text-md font-medium text-gray-700 mb-2">{section.name}</h3>
                {sectionTables.length === 0 ? (
                  <p className="text-sm text-gray-400 italic mb-2">No tables in this section</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                    {sectionTables.map((table) => (
                      <div key={table.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{table.name}</p>
                          <p className="text-xs text-gray-500">Seats {table.capacity}</p>
                        </div>
                        <button
                          onClick={() => removeTable(table.id)}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex gap-2 mt-4 pt-4 border-t">
            <input
              type="text"
              placeholder="Table name"
              value={newTable.name}
              onChange={(e) => setNewTable({ ...newTable, name: e.target.value })}
              className="flex-1 border rounded-lg px-3 py-2 text-sm text-gray-900"
            />
            <input
              type="number"
              placeholder="Seats"
              value={newTable.capacity}
              onChange={(e) => setNewTable({ ...newTable, capacity: parseInt(e.target.value) || 2 })}
              className="w-20 border rounded-lg px-3 py-2 text-sm text-gray-900"
            />
            <select
              value={newTable.section_id}
              onChange={(e) => setNewTable({ ...newTable, section_id: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm text-gray-900"
            >
              <option value="">Section...</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={addTable}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium whitespace-nowrap"
            >
              + Add Table
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
