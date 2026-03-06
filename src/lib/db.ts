import { sql } from "@vercel/postgres";

// ---- Types ----

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  owner_email?: string;
  vapi_assistant_id?: string;
  twilio_phone?: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  created_at: string;
}

export interface Section {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  display_order: number;
}

export interface Table {
  id: string;
  name: string;
  capacity: number;
  section_id: string;
  restaurant_id: string;
  section_name?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface Reservation {
  id: string;
  restaurant_id: string;
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
  restaurant_id: string;
  name: string;
  phone?: string;
  address?: string;
  open_time: string;
  close_time: string;
  last_seating: string;
  reservation_duration_minutes: number;
}

// ---- Schema ----

let _initialized = false;

export async function initDB() {
  if (_initialized) return;

  // Users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      image TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Restaurants table (tenant root)
  await sql`
    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      owner_email TEXT,
      vapi_assistant_id TEXT,
      twilio_phone TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Restaurant settings — keyed by restaurant_id
  await sql`
    CREATE TABLE IF NOT EXISTS restaurant_settings (
      restaurant_id TEXT PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
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
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
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
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      x DOUBLE PRECISION,
      y DOUBLE PRECISION,
      w DOUBLE PRECISION,
      h DOUBLE PRECISION
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
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

  // Add columns that might be missing on older DBs (idempotent)
  const safeAddCol = async (table: string, col: string, type: string) => {
    try {
      await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${type}`);
    } catch { /* column likely already exists */ }
  };

  // Fix legacy restaurant_settings: old schema had id INTEGER DEFAULT 1 as PK
  // which breaks multi-tenant inserts. Switch PK to restaurant_id.
  try {
    // Check if the old integer PK constraint exists
    const { rows: pkCheck } = await sql`
      SELECT column_name, column_default FROM information_schema.columns
      WHERE table_name = 'restaurant_settings' AND column_name = 'id' AND data_type = 'integer'
    `;
    if (pkCheck.length > 0) {
      await sql`ALTER TABLE restaurant_settings DROP CONSTRAINT IF EXISTS restaurant_settings_pkey`;
      await sql`ALTER TABLE restaurant_settings DROP COLUMN IF EXISTS id`;
      await sql`ALTER TABLE restaurant_settings ADD PRIMARY KEY (restaurant_id)`;
    }
  } catch { /* table may not exist yet or already migrated */ }

  await safeAddCol("restaurants", "owner_email", "TEXT");
  await safeAddCol("restaurants", "vapi_assistant_id", "TEXT");
  await safeAddCol("restaurants", "twilio_phone", "TEXT");
  await safeAddCol("sections", "restaurant_id", "TEXT");
  await safeAddCol("tables", "restaurant_id", "TEXT");
  await safeAddCol("tables", "x", "DOUBLE PRECISION");
  await safeAddCol("tables", "y", "DOUBLE PRECISION");
  await safeAddCol("tables", "w", "DOUBLE PRECISION");
  await safeAddCol("tables", "h", "DOUBLE PRECISION");
  await safeAddCol("reservations", "restaurant_id", "TEXT");
  await safeAddCol("restaurant_settings", "restaurant_id", "TEXT");

  _initialized = true;
}

// ---- Helpers ----

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function timesOverlap(time1: string, time2: string, durationMins: number): boolean {
  const mins1 = timeToMinutes(time1);
  const mins2 = timeToMinutes(time2);
  return Math.abs(mins1 - mins2) < durationMins;
}

// ---- Users ----

export async function upsertUser(email: string, name?: string, image?: string): Promise<User> {
  await initDB();
  const id = email; // email as id for simplicity
  await sql`
    INSERT INTO users (id, email, name, image)
    VALUES (${id}, ${email}, ${name || null}, ${image || null})
    ON CONFLICT (email) DO UPDATE SET name = COALESCE(${name || null}, users.name), image = COALESCE(${image || null}, users.image)
  `;
  const { rows } = await sql`SELECT * FROM users WHERE email = ${email}`;
  return rows[0] as User;
}

export async function getRestaurantsByOwner(email: string): Promise<Restaurant[]> {
  await initDB();
  const { rows } = await sql`SELECT * FROM restaurants WHERE owner_email = ${email} ORDER BY created_at`;
  return rows as Restaurant[];
}

// ---- Restaurant ----

export async function getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
  await initDB();
  const { rows } = await sql`SELECT * FROM restaurants WHERE slug = ${slug} LIMIT 1`;
  return (rows[0] as Restaurant) ?? null;
}

export async function setRestaurantVapiAssistant(id: string, assistantId: string): Promise<void> {
  await initDB();
  await sql`UPDATE restaurants SET vapi_assistant_id = ${assistantId} WHERE id = ${id}`;
}

export async function createRestaurant(slug: string, name: string, ownerEmail?: string): Promise<Restaurant> {
  await initDB();
  const id = slug;
  await sql`INSERT INTO restaurants (id, slug, name, owner_email) VALUES (${id}, ${slug}, ${name}, ${ownerEmail || null})`;

  // Create default settings
  await sql`INSERT INTO restaurant_settings (restaurant_id, name) VALUES (${id}, ${name})`;

  // Seed default sections
  const defaultSections = [
    { id: `${id}-indoor`, name: "Indoor", description: "Main dining area", order: 0 },
    { id: `${id}-outdoor`, name: "Outdoor", description: "Patio seating", order: 1 },
    { id: `${id}-bar`, name: "Bar", description: "Bar counter seating", order: 2 },
  ];

  for (const s of defaultSections) {
    await sql`INSERT INTO sections (id, restaurant_id, name, description, display_order) VALUES (${s.id}, ${id}, ${s.name}, ${s.description}, ${s.order})`;
  }

  // Seed default tables
  const defaultTables = [
    { name: "Table 1", capacity: 2, section: `${id}-indoor` },
    { name: "Table 2", capacity: 2, section: `${id}-indoor` },
    { name: "Table 3", capacity: 4, section: `${id}-indoor` },
    { name: "Table 4", capacity: 4, section: `${id}-indoor` },
    { name: "Table 5", capacity: 6, section: `${id}-indoor` },
    { name: "Patio 1", capacity: 4, section: `${id}-outdoor` },
    { name: "Patio 2", capacity: 4, section: `${id}-outdoor` },
    { name: "Bar 1", capacity: 2, section: `${id}-bar` },
    { name: "Bar 2", capacity: 2, section: `${id}-bar` },
  ];

  const counters: Record<string, number> = {};
  for (const t of defaultTables) {
    const idx = counters[t.section] ?? 0;
    counters[t.section] = idx + 1;
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const tid = `${id}-t${Date.now()}-${idx}`;
    await sql`
      INSERT INTO tables (id, name, capacity, section_id, restaurant_id, x, y, w, h)
      VALUES (${tid}, ${t.name}, ${t.capacity}, ${t.section}, ${id}, ${6 + col * 30}, ${8 + row * 22}, ${22}, ${18})
    `;
  }

  const { rows } = await sql`SELECT * FROM restaurants WHERE id = ${id}`;
  return rows[0] as Restaurant;
}

export async function isRestaurantOwner(restaurantId: string, email: string): Promise<boolean> {
  await initDB();
  const { rows } = await sql`SELECT owner_email FROM restaurants WHERE id = ${restaurantId}`;
  if (rows.length === 0) return false;
  // If no owner set (e.g., demo), allow anyone who's logged in (for now)
  if (!rows[0].owner_email) return true;
  return rows[0].owner_email === email;
}

// ---- Settings (scoped) ----

export async function getSettings(restaurantId: string): Promise<RestaurantSettings> {
  await initDB();
  const { rows } = await sql`SELECT * FROM restaurant_settings WHERE restaurant_id = ${restaurantId} LIMIT 1`;
  return rows[0] as RestaurantSettings;
}

export async function updateSettings(restaurantId: string, settings: Partial<RestaurantSettings>): Promise<RestaurantSettings> {
  await initDB();
  if (settings.name !== undefined) await sql`UPDATE restaurant_settings SET name = ${settings.name} WHERE restaurant_id = ${restaurantId}`;
  if (settings.phone !== undefined) await sql`UPDATE restaurant_settings SET phone = ${settings.phone} WHERE restaurant_id = ${restaurantId}`;
  if (settings.address !== undefined) await sql`UPDATE restaurant_settings SET address = ${settings.address} WHERE restaurant_id = ${restaurantId}`;
  if (settings.open_time !== undefined) await sql`UPDATE restaurant_settings SET open_time = ${settings.open_time} WHERE restaurant_id = ${restaurantId}`;
  if (settings.close_time !== undefined) await sql`UPDATE restaurant_settings SET close_time = ${settings.close_time} WHERE restaurant_id = ${restaurantId}`;
  if (settings.last_seating !== undefined) await sql`UPDATE restaurant_settings SET last_seating = ${settings.last_seating} WHERE restaurant_id = ${restaurantId}`;
  if (settings.reservation_duration_minutes !== undefined) await sql`UPDATE restaurant_settings SET reservation_duration_minutes = ${settings.reservation_duration_minutes} WHERE restaurant_id = ${restaurantId}`;
  return getSettings(restaurantId);
}

// ---- Sections (scoped) ----

export async function getSections(restaurantId: string): Promise<Section[]> {
  await initDB();
  const { rows } = await sql`SELECT * FROM sections WHERE restaurant_id = ${restaurantId} ORDER BY display_order`;
  return rows as Section[];
}

export async function createSection(restaurantId: string, name: string, description?: string): Promise<Section> {
  await initDB();
  const id = `${restaurantId}-${name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-")}`;
  const { rows: orderRows } = await sql`SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM sections WHERE restaurant_id = ${restaurantId}`;
  const order = orderRows[0].next_order;
  await sql`INSERT INTO sections (id, restaurant_id, name, description, display_order) VALUES (${id}, ${restaurantId}, ${name}, ${description || null}, ${order})`;
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

// ---- Tables (scoped) ----

export async function getTables(restaurantId: string): Promise<Table[]> {
  await initDB();
  const { rows } = await sql`
    SELECT t.*, s.name as section_name
    FROM tables t JOIN sections s ON t.section_id = s.id
    WHERE t.restaurant_id = ${restaurantId}
    ORDER BY s.display_order, t.name
  `;
  return rows as Table[];
}

export async function createTable(
  restaurantId: string,
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
    INSERT INTO tables (id, name, capacity, section_id, restaurant_id, x, y, w, h)
    VALUES (${id}, ${name}, ${capacity}, ${sectionId}, ${restaurantId}, ${x}, ${y}, ${w}, ${h})
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

// ---- Reservations (scoped) ----

export async function getReservations(restaurantId: string, date?: string): Promise<Reservation[]> {
  await initDB();
  if (date) {
    const { rows } = await sql`
      SELECT r.*, s.name as section_name
      FROM reservations r
      JOIN tables t ON r.table_id = t.id
      JOIN sections s ON t.section_id = s.id
      WHERE r.restaurant_id = ${restaurantId} AND r.date = ${date} AND r.status = 'confirmed'
      ORDER BY r.time
    `;
    return rows as Reservation[];
  }
  const { rows } = await sql`
    SELECT r.*, s.name as section_name
    FROM reservations r
    JOIN tables t ON r.table_id = t.id
    JOIN sections s ON t.section_id = s.id
    WHERE r.restaurant_id = ${restaurantId} AND r.status = 'confirmed'
    ORDER BY r.date, r.time
  `;
  return rows as Reservation[];
}

async function getReservationDuration(restaurantId: string): Promise<number> {
  const { rows } = await sql`SELECT reservation_duration_minutes FROM restaurant_settings WHERE restaurant_id = ${restaurantId}`;
  return rows[0]?.reservation_duration_minutes || 90;
}

export async function checkAvailability(
  restaurantId: string,
  date: string,
  time: string,
  partySize: number,
  section?: string
): Promise<{ available: boolean; tables: Table[]; alternativeTimes?: string[]; sectionFallback?: boolean }> {
  await initDB();
  const durationMins = await getReservationDuration(restaurantId);

  // Get all tables with enough capacity
  const { rows: allMatchingTables } = await sql`
    SELECT t.*, s.name as section_name FROM tables t
    JOIN sections s ON t.section_id = s.id
    WHERE t.restaurant_id = ${restaurantId} AND t.capacity >= ${partySize}
  `;
  const allTables = allMatchingTables as Table[];

  // If a section preference was given, try to match it flexibly
  let tables: Table[];
  let sectionFallback = false;
  if (section) {
    const sectionLower = section.toLowerCase();
    // Fuzzy match: check if section name contains the search term or vice versa
    // e.g. "outside" matches "Outdoor", "patio" matches "Patio Dining"
    const sectionSynonyms: Record<string, string[]> = {
      outdoor: ["outside", "outdoors", "patio", "terrace", "garden", "al fresco", "exterior"],
      indoor: ["inside", "indoors", "interior", "main", "dining room"],
      bar: ["lounge", "counter", "high top", "high-top"],
      private: ["vip", "private room", "private dining"],
    };

    tables = allTables.filter((t) => {
      const name = (t.section_name || "").toLowerCase();
      // Direct match
      if (name === sectionLower || name.includes(sectionLower) || sectionLower.includes(name)) return true;
      // Synonym match
      for (const [canonical, synonyms] of Object.entries(sectionSynonyms)) {
        const allTerms = [canonical, ...synonyms];
        const nameMatches = allTerms.some((term) => name.includes(term));
        const queryMatches = allTerms.some((term) => sectionLower.includes(term));
        if (nameMatches && queryMatches) return true;
      }
      return false;
    });

    // If no tables in requested section, fall back to all tables
    if (tables.length === 0) {
      tables = allTables;
      sectionFallback = true;
    }
  } else {
    tables = allTables;
  }

  const { rows: dateReservations } = await sql`
    SELECT * FROM reservations WHERE restaurant_id = ${restaurantId} AND date = ${date} AND status = 'confirmed'
  `;

  const availableTables = tables.filter((table) => {
    const tableRes = dateReservations.filter((r) => r.table_id === table.id);
    return !tableRes.some((r) => timesOverlap(r.time, time, durationMins));
  });

  if (availableTables.length > 0) {
    return { available: true, tables: availableTables, sectionFallback };
  }

  const settings = await getSettings(restaurantId);
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
  restaurantId: string,
  guestName: string,
  partySize: number,
  date: string,
  time: string,
  specialRequests?: string,
  phone?: string,
  preferredSection?: string
): Promise<Reservation | { error: string; alternativeTimes?: string[] }> {
  const availability = await checkAvailability(restaurantId, date, time, partySize, preferredSection);

  if (!availability.available) {
    return {
      error: `No tables available for a party of ${partySize} on ${date} at ${time}.`,
      alternativeTimes: availability.alternativeTimes,
    };
  }

  const table = availability.tables.sort((a, b) => a.capacity - b.capacity)[0];
  const id = `r${Date.now()}`;

  await sql`
    INSERT INTO reservations (id, restaurant_id, guest_name, party_size, date, time, table_id, special_requests, phone, status)
    VALUES (${id}, ${restaurantId}, ${guestName}, ${partySize}, ${date}, ${time}, ${table.id}, ${specialRequests || null}, ${phone || null}, 'confirmed')
  `;

  const { rows } = await sql`
    SELECT r.*, s.name as section_name
    FROM reservations r JOIN tables t ON r.table_id = t.id JOIN sections s ON t.section_id = s.id
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
    UPDATE reservations SET guest_name = ${newName}, party_size = ${newSize}, date = ${newDate}, time = ${newTime},
        special_requests = ${newRequests}, phone = ${newPhone} WHERE id = ${reservationId}
  `;

  const { rows: updated } = await sql`
    SELECT r.*, s.name as section_name FROM reservations r JOIN tables t ON r.table_id = t.id JOIN sections s ON t.section_id = s.id WHERE r.id = ${reservationId}
  `;
  return updated[0] as Reservation;
}

export async function cancelReservation(reservationId: string): Promise<boolean> {
  await initDB();
  const { rowCount } = await sql`UPDATE reservations SET status = 'cancelled' WHERE id = ${reservationId} AND status = 'confirmed'`;
  return (rowCount ?? 0) > 0;
}

export async function findReservation(restaurantId: string, guestName: string, date?: string): Promise<Reservation[]> {
  await initDB();
  if (date) {
    const { rows } = await sql`
      SELECT r.*, s.name as section_name FROM reservations r
      JOIN tables t ON r.table_id = t.id JOIN sections s ON t.section_id = s.id
      WHERE r.restaurant_id = ${restaurantId} AND LOWER(r.guest_name) LIKE ${'%' + guestName.toLowerCase() + '%'} AND r.date = ${date} AND r.status = 'confirmed'
    `;
    return rows as Reservation[];
  }
  const { rows } = await sql`
    SELECT r.*, s.name as section_name FROM reservations r
    JOIN tables t ON r.table_id = t.id JOIN sections s ON t.section_id = s.id
    WHERE r.restaurant_id = ${restaurantId} AND LOWER(r.guest_name) LIKE ${'%' + guestName.toLowerCase() + '%'} AND r.status = 'confirmed'
  `;
  return rows as Reservation[];
}
