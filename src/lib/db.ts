import { sql } from "@vercel/postgres";

export interface Section {
  id: string;
  name: string;
  description?: string;
  display_order: number;
}

export interface Table {
  id: string;
  name: string;
  capacity: number;
  section_id: string;
  section_name?: string;
  // Floorplan geometry (percent of canvas: 0-100)
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface Reservation {
  id: string;
  guest_name: string;
  party_size: number;
  date: string;
  time: string;
  table_id: string;
  section_name?: string;
  special_requests?: string;
  phone?: string;
  status: "confirmed" | "cancelled";
  created_at: string;
}

export interface RestaurantSettings {
  name: string;
  phone?: string;
  address?: string;
  open_time: string;
  close_time: string;
  last_seating: string;
  reservation_duration_minutes: number;
}

// Initialize database tables
export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS restaurant_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT NOT NULL DEFAULT 'My Restaurant',
      phone TEXT,
      address TEXT,
      open_time TEXT DEFAULT '11:00',
      close_time TEXT DEFAULT '22:00',
      last_seating TEXT DEFAULT '21:30',
      reservation_duration_minutes INTEGER DEFAULT 90
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      display_order INTEGER DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE
    )
  `;

  // Floorplan columns (added later; keep idempotent for existing DBs)
  await sql`ALTER TABLE tables ADD COLUMN IF NOT EXISTS x DOUBLE PRECISION`;
  await sql`ALTER TABLE tables ADD COLUMN IF NOT EXISTS y DOUBLE PRECISION`;
  await sql`ALTER TABLE tables ADD COLUMN IF NOT EXISTS w DOUBLE PRECISION`;
  await sql`ALTER TABLE tables ADD COLUMN IF NOT EXISTS h DOUBLE PRECISION`;

  await sql`
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      guest_name TEXT NOT NULL,
      party_size INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      table_id TEXT NOT NULL,
      special_requests TEXT,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Seed defaults if empty
  const { rows: settingsRows } = await sql`SELECT COUNT(*) as count FROM restaurant_settings`;
  if (parseInt(settingsRows[0].count) === 0) {
    await sql`INSERT INTO restaurant_settings (id, name) VALUES (1, 'My Restaurant')`;
  }

  const { rows: sectionRows } = await sql`SELECT COUNT(*) as count FROM sections`;
  if (parseInt(sectionRows[0].count) === 0) {
    await sql`INSERT INTO sections (id, name, description, display_order) VALUES ('indoor', 'Indoor', 'Main dining area', 0)`;
    await sql`INSERT INTO sections (id, name, description, display_order) VALUES ('outdoor', 'Outdoor', 'Patio seating', 1)`;
    await sql`INSERT INTO sections (id, name, description, display_order) VALUES ('bar', 'Bar', 'Bar counter seating', 2)`;
    await sql`INSERT INTO sections (id, name, description, display_order) VALUES ('private', 'Private', 'Private dining room', 3)`;

    // Seed default tables
    const defaultTables = [
      { id: "t1", name: "Table 1", capacity: 2, section_id: "indoor" },
      { id: "t2", name: "Table 2", capacity: 2, section_id: "indoor" },
      { id: "t3", name: "Table 3", capacity: 4, section_id: "indoor" },
      { id: "t4", name: "Table 4", capacity: 4, section_id: "indoor" },
      { id: "t5", name: "Table 5", capacity: 6, section_id: "indoor" },
      { id: "t6", name: "Table 6", capacity: 6, section_id: "indoor" },
      { id: "t7", name: "Table 7", capacity: 8, section_id: "private" },
      { id: "t8", name: "Patio 1", capacity: 4, section_id: "outdoor" },
      { id: "t9", name: "Patio 2", capacity: 4, section_id: "outdoor" },
      { id: "t10", name: "Patio 3", capacity: 6, section_id: "outdoor" },
      { id: "t11", name: "Bar 1", capacity: 2, section_id: "bar" },
      { id: "t12", name: "Bar 2", capacity: 2, section_id: "bar" },
    ];
    const sectionCounters: Record<string, number> = {};
    for (const t of defaultTables) {
      const idx = sectionCounters[t.section_id] ?? 0;
      sectionCounters[t.section_id] = idx + 1;

      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = 6 + col * 30;
      const y = 8 + row * 22;
      const w = 22;
      const h = 18;

      await sql`
        INSERT INTO tables (id, name, capacity, section_id, x, y, w, h)
        VALUES (${t.id}, ${t.name}, ${t.capacity}, ${t.section_id}, ${x}, ${y}, ${w}, ${h})
      `;
    }
  }

  // Backfill missing floorplan geometry for existing tables
  const { rows: missingLayout } = await sql`
    SELECT id, section_id, name FROM tables
    WHERE x IS NULL OR y IS NULL OR w IS NULL OR h IS NULL
    ORDER BY section_id, name
  `;

  if (missingLayout.length > 0) {
    const counters: Record<string, number> = {};
    for (const row of missingLayout as Array<{ id: string; section_id: string }>) {
      const idx = counters[row.section_id] ?? 0;
      counters[row.section_id] = idx + 1;

      const col = idx % 3;
      const r = Math.floor(idx / 3);
      const x = 6 + col * 30;
      const y = 8 + r * 22;
      const w = 22;
      const h = 18;

      await sql`UPDATE tables SET x = ${x}, y = ${y}, w = ${w}, h = ${h} WHERE id = ${row.id}`;
    }
  }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

async function getReservationDuration(): Promise<number> {
  const { rows } = await sql`SELECT reservation_duration_minutes FROM restaurant_settings WHERE id = 1`;
  return rows[0]?.reservation_duration_minutes || 90;
}

function timesOverlap(time1: string, time2: string, durationMins: number): boolean {
  const mins1 = timeToMinutes(time1);
  const mins2 = timeToMinutes(time2);
  return Math.abs(mins1 - mins2) < durationMins;
}

// ---- Settings ----

export async function getSettings(): Promise<RestaurantSettings> {
  await initDB();
  const { rows } = await sql`SELECT * FROM restaurant_settings WHERE id = 1`;
  return rows[0] as RestaurantSettings;
}

export async function updateSettings(settings: Partial<RestaurantSettings>): Promise<RestaurantSettings> {
  await initDB();
  if (settings.name !== undefined) await sql`UPDATE restaurant_settings SET name = ${settings.name} WHERE id = 1`;
  if (settings.phone !== undefined) await sql`UPDATE restaurant_settings SET phone = ${settings.phone} WHERE id = 1`;
  if (settings.address !== undefined) await sql`UPDATE restaurant_settings SET address = ${settings.address} WHERE id = 1`;
  if (settings.open_time !== undefined) await sql`UPDATE restaurant_settings SET open_time = ${settings.open_time} WHERE id = 1`;
  if (settings.close_time !== undefined) await sql`UPDATE restaurant_settings SET close_time = ${settings.close_time} WHERE id = 1`;
  if (settings.last_seating !== undefined) await sql`UPDATE restaurant_settings SET last_seating = ${settings.last_seating} WHERE id = 1`;
  if (settings.reservation_duration_minutes !== undefined) await sql`UPDATE restaurant_settings SET reservation_duration_minutes = ${settings.reservation_duration_minutes} WHERE id = 1`;
  return getSettings();
}

// ---- Sections ----

export async function getSections(): Promise<Section[]> {
  await initDB();
  const { rows } = await sql`SELECT * FROM sections ORDER BY display_order`;
  return rows as Section[];
}

export async function createSection(name: string, description?: string): Promise<Section> {
  await initDB();
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  const { rows: orderRows } = await sql`SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM sections`;
  const order = orderRows[0].next_order;
  await sql`INSERT INTO sections (id, name, description, display_order) VALUES (${id}, ${name}, ${description || null}, ${order})`;
  const { rows } = await sql`SELECT * FROM sections WHERE id = ${id}`;
  return rows[0] as Section;
}

export async function updateSection(id: string, name?: string, description?: string): Promise<Section> {
  await initDB();
  if (name !== undefined) await sql`UPDATE sections SET name = ${name} WHERE id = ${id}`;
  if (description !== undefined) await sql`UPDATE sections SET description = ${description} WHERE id = ${id}`;
  const { rows } = await sql`SELECT * FROM sections WHERE id = ${id}`;
  return rows[0] as Section;
}

export async function deleteSection(id: string): Promise<boolean> {
  await initDB();
  const { rowCount } = await sql`DELETE FROM sections WHERE id = ${id}`;
  return (rowCount ?? 0) > 0;
}

// ---- Tables ----

export async function getTables(): Promise<Table[]> {
  await initDB();
  const { rows } = await sql`
    SELECT t.*, s.name as section_name 
    FROM tables t JOIN sections s ON t.section_id = s.id 
    ORDER BY s.display_order, t.name
  `;
  return rows as Table[];
}

export async function createTable(
  name: string,
  capacity: number,
  sectionId: string,
  layout?: { x?: number; y?: number; w?: number; h?: number }
): Promise<Table> {
  await initDB();
  const id = `t${Date.now()}`;
  const x = layout?.x ?? 6;
  const y = layout?.y ?? 8;
  const w = layout?.w ?? 22;
  const h = layout?.h ?? 18;

  await sql`
    INSERT INTO tables (id, name, capacity, section_id, x, y, w, h)
    VALUES (${id}, ${name}, ${capacity}, ${sectionId}, ${x}, ${y}, ${w}, ${h})
  `;

  const { rows } = await sql`SELECT t.*, s.name as section_name FROM tables t JOIN sections s ON t.section_id = s.id WHERE t.id = ${id}`;
  return rows[0] as Table;
}

export async function updateTable(
  id: string,
  updates: { name?: string; capacity?: number; sectionId?: string; x?: number; y?: number; w?: number; h?: number }
): Promise<Table> {
  await initDB();
  if (updates.name !== undefined) await sql`UPDATE tables SET name = ${updates.name} WHERE id = ${id}`;
  if (updates.capacity !== undefined) await sql`UPDATE tables SET capacity = ${updates.capacity} WHERE id = ${id}`;
  if (updates.sectionId !== undefined) await sql`UPDATE tables SET section_id = ${updates.sectionId} WHERE id = ${id}`;
  if (updates.x !== undefined) await sql`UPDATE tables SET x = ${updates.x} WHERE id = ${id}`;
  if (updates.y !== undefined) await sql`UPDATE tables SET y = ${updates.y} WHERE id = ${id}`;
  if (updates.w !== undefined) await sql`UPDATE tables SET w = ${updates.w} WHERE id = ${id}`;
  if (updates.h !== undefined) await sql`UPDATE tables SET h = ${updates.h} WHERE id = ${id}`;

  const { rows } = await sql`SELECT t.*, s.name as section_name FROM tables t JOIN sections s ON t.section_id = s.id WHERE t.id = ${id}`;
  return rows[0] as Table;
}

export async function deleteTable(id: string): Promise<boolean> {
  await initDB();
  const { rowCount } = await sql`DELETE FROM tables WHERE id = ${id}`;
  return (rowCount ?? 0) > 0;
}

// ---- Reservations ----

export async function getReservations(date?: string): Promise<Reservation[]> {
  await initDB();
  if (date) {
    const { rows } = await sql`
      SELECT r.*, s.name as section_name 
      FROM reservations r 
      JOIN tables t ON r.table_id = t.id 
      JOIN sections s ON t.section_id = s.id 
      WHERE r.date = ${date} AND r.status = 'confirmed' 
      ORDER BY r.time
    `;
    return rows as Reservation[];
  }
  const { rows } = await sql`
    SELECT r.*, s.name as section_name 
    FROM reservations r 
    JOIN tables t ON r.table_id = t.id 
    JOIN sections s ON t.section_id = s.id 
    WHERE r.status = 'confirmed' 
    ORDER BY r.date, r.time
  `;
  return rows as Reservation[];
}

export async function checkAvailability(
  date: string,
  time: string,
  partySize: number,
  section?: string
): Promise<{ available: boolean; tables: Table[]; alternativeTimes?: string[] }> {
  await initDB();
  const durationMins = await getReservationDuration();

  let tables: Table[];
  if (section) {
    // Match by section name (case-insensitive) or section id
    const { rows } = await sql`
      SELECT t.*, s.name as section_name FROM tables t 
      JOIN sections s ON t.section_id = s.id 
      WHERE t.capacity >= ${partySize} AND (LOWER(s.name) = LOWER(${section}) OR s.id = ${section})
    `;
    tables = rows as Table[];
  } else {
    const { rows } = await sql`
      SELECT t.*, s.name as section_name FROM tables t 
      JOIN sections s ON t.section_id = s.id 
      WHERE t.capacity >= ${partySize}
    `;
    tables = rows as Table[];
  }

  const { rows: dateReservations } = await sql`
    SELECT * FROM reservations WHERE date = ${date} AND status = 'confirmed'
  `;

  const availableTables = tables.filter((table) => {
    const tableRes = dateReservations.filter((r) => r.table_id === table.id);
    return !tableRes.some((r) => timesOverlap(r.time, time, durationMins));
  });

  if (availableTables.length > 0) {
    return { available: true, tables: availableTables };
  }

  // Suggest alternatives
  const settings = await getSettings();
  const openMins = timeToMinutes(settings.open_time);
  const lastMins = timeToMinutes(settings.last_seating);
  const requestedMins = timeToMinutes(time);
  const alternativeTimes: string[] = [];

  for (const offset of [-60, -30, 30, 60, 90, 120]) {
    const altMins = requestedMins + offset;
    if (altMins < openMins || altMins > lastMins) continue;
    const altTime = `${Math.floor(altMins / 60).toString().padStart(2, "0")}:${(altMins % 60).toString().padStart(2, "0")}`;

    const altAvailable = tables.some((table) => {
      const tableRes = dateReservations.filter((r) => r.table_id === table.id);
      return !tableRes.some((r) => timesOverlap(r.time, altTime, durationMins));
    });

    if (altAvailable) alternativeTimes.push(altTime);
  }

  return { available: false, tables: [], alternativeTimes };
}

export async function createReservation(
  guestName: string,
  partySize: number,
  date: string,
  time: string,
  specialRequests?: string,
  phone?: string,
  preferredSection?: string
): Promise<Reservation | { error: string; alternativeTimes?: string[] }> {
  const availability = await checkAvailability(date, time, partySize, preferredSection);

  if (!availability.available) {
    return {
      error: `No tables available for a party of ${partySize} on ${date} at ${time}.`,
      alternativeTimes: availability.alternativeTimes,
    };
  }

  const table = availability.tables.sort((a, b) => a.capacity - b.capacity)[0];
  const id = `r${Date.now()}`;

  await sql`
    INSERT INTO reservations (id, guest_name, party_size, date, time, table_id, special_requests, phone, status)
    VALUES (${id}, ${guestName}, ${partySize}, ${date}, ${time}, ${table.id}, ${specialRequests || null}, ${phone || null}, 'confirmed')
  `;

  const { rows } = await sql`
    SELECT r.*, s.name as section_name 
    FROM reservations r 
    JOIN tables t ON r.table_id = t.id 
    JOIN sections s ON t.section_id = s.id 
    WHERE r.id = ${id}
  `;
  return rows[0] as Reservation;
}

export async function updateReservation(
  reservationId: string,
  updates: { guestName?: string; partySize?: number; date?: string; time?: string; specialRequests?: string; phone?: string }
): Promise<Reservation | { error: string }> {
  await initDB();
  const { rows } = await sql`SELECT * FROM reservations WHERE id = ${reservationId} AND status = 'confirmed'`;
  if (rows.length === 0) return { error: "Reservation not found." };

  const r = rows[0];
  const newName = updates.guestName || r.guest_name;
  const newSize = updates.partySize || r.party_size;
  const newDate = updates.date || r.date;
  const newTime = updates.time || r.time;
  const newRequests = updates.specialRequests !== undefined ? updates.specialRequests : r.special_requests;
  const newPhone = updates.phone || r.phone;

  await sql`
    UPDATE reservations
    SET guest_name = ${newName}, party_size = ${newSize}, date = ${newDate}, time = ${newTime},
        special_requests = ${newRequests}, phone = ${newPhone}
    WHERE id = ${reservationId}
  `;

  const { rows: updated } = await sql`
    SELECT r.*, s.name as section_name 
    FROM reservations r 
    JOIN tables t ON r.table_id = t.id 
    JOIN sections s ON t.section_id = s.id 
    WHERE r.id = ${reservationId}
  `;
  return updated[0] as Reservation;
}

export async function cancelReservation(reservationId: string): Promise<boolean> {
  await initDB();
  const { rowCount } = await sql`UPDATE reservations SET status = 'cancelled' WHERE id = ${reservationId} AND status = 'confirmed'`;
  return (rowCount ?? 0) > 0;
}

export async function findReservation(guestName: string, date?: string): Promise<Reservation[]> {
  await initDB();
  if (date) {
    const { rows } = await sql`
      SELECT r.*, s.name as section_name FROM reservations r
      JOIN tables t ON r.table_id = t.id JOIN sections s ON t.section_id = s.id
      WHERE LOWER(r.guest_name) LIKE ${'%' + guestName.toLowerCase() + '%'} AND r.date = ${date} AND r.status = 'confirmed'
    `;
    return rows as Reservation[];
  }
  const { rows } = await sql`
    SELECT r.*, s.name as section_name FROM reservations r
    JOIN tables t ON r.table_id = t.id JOIN sections s ON t.section_id = s.id
    WHERE LOWER(r.guest_name) LIKE ${'%' + guestName.toLowerCase() + '%'} AND r.status = 'confirmed'
  `;
  return rows as Reservation[];
}
