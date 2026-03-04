import { sql } from "@vercel/postgres";

export interface Table {
  id: string;
  name: string;
  capacity: number;
  section: "indoor" | "outdoor" | "bar" | "private";
}

export interface Reservation {
  id: string;
  guest_name: string;
  party_size: number;
  date: string;
  time: string;
  table_id: string;
  special_requests?: string;
  phone?: string;
  status: "confirmed" | "cancelled";
  created_at: string;
}

// Initialize database tables
export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      section TEXT NOT NULL
    )
  `;

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

  // Seed default tables if empty
  const { rows } = await sql`SELECT COUNT(*) as count FROM tables`;
  if (parseInt(rows[0].count) === 0) {
    const defaultTables = [
      { id: "t1", name: "Table 1", capacity: 2, section: "indoor" },
      { id: "t2", name: "Table 2", capacity: 2, section: "indoor" },
      { id: "t3", name: "Table 3", capacity: 4, section: "indoor" },
      { id: "t4", name: "Table 4", capacity: 4, section: "indoor" },
      { id: "t5", name: "Table 5", capacity: 6, section: "indoor" },
      { id: "t6", name: "Table 6", capacity: 6, section: "indoor" },
      { id: "t7", name: "Table 7", capacity: 8, section: "private" },
      { id: "t8", name: "Patio 1", capacity: 4, section: "outdoor" },
      { id: "t9", name: "Patio 2", capacity: 4, section: "outdoor" },
      { id: "t10", name: "Patio 3", capacity: 6, section: "outdoor" },
      { id: "t11", name: "Bar 1", capacity: 2, section: "bar" },
      { id: "t12", name: "Bar 2", capacity: 2, section: "bar" },
    ];
    for (const t of defaultTables) {
      await sql`INSERT INTO tables (id, name, capacity, section) VALUES (${t.id}, ${t.name}, ${t.capacity}, ${t.section})`;
    }
  }
}

const RESERVATION_DURATION_HOURS = 1.5;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function timesOverlap(time1: string, time2: string): boolean {
  const mins1 = timeToMinutes(time1);
  const mins2 = timeToMinutes(time2);
  const durationMins = RESERVATION_DURATION_HOURS * 60;
  return Math.abs(mins1 - mins2) < durationMins;
}

export async function getTables(): Promise<Table[]> {
  await initDB();
  const { rows } = await sql`SELECT * FROM tables ORDER BY id`;
  return rows as Table[];
}

export async function getReservations(date?: string): Promise<Reservation[]> {
  await initDB();
  if (date) {
    const { rows } = await sql`SELECT * FROM reservations WHERE date = ${date} AND status = 'confirmed' ORDER BY time`;
    return rows as Reservation[];
  }
  const { rows } = await sql`SELECT * FROM reservations WHERE status = 'confirmed' ORDER BY date, time`;
  return rows as Reservation[];
}

export async function checkAvailability(
  date: string,
  time: string,
  partySize: number,
  section?: string
): Promise<{ available: boolean; tables: Table[]; alternativeTimes?: string[] }> {
  await initDB();

  // Find suitable tables
  let tables: Table[];
  if (section) {
    const { rows } = await sql`SELECT * FROM tables WHERE capacity >= ${partySize} AND section = ${section}`;
    tables = rows as Table[];
  } else {
    const { rows } = await sql`SELECT * FROM tables WHERE capacity >= ${partySize}`;
    tables = rows as Table[];
  }

  // Get reservations for that date
  const { rows: dateReservations } = await sql`
    SELECT * FROM reservations WHERE date = ${date} AND status = 'confirmed'
  `;

  const availableTables = tables.filter((table) => {
    const tableRes = dateReservations.filter((r) => r.table_id === table.id);
    return !tableRes.some((r) => timesOverlap(r.time, time));
  });

  if (availableTables.length > 0) {
    return { available: true, tables: availableTables };
  }

  // Suggest alternatives
  const requestedMins = timeToMinutes(time);
  const alternativeTimes: string[] = [];

  for (const offset of [-60, -30, 30, 60, 90, 120]) {
    const altMins = requestedMins + offset;
    if (altMins < 660 || altMins > 1290) continue;
    const altTime = `${Math.floor(altMins / 60).toString().padStart(2, "0")}:${(altMins % 60).toString().padStart(2, "0")}`;

    const altAvailable = tables.some((table) => {
      const tableRes = dateReservations.filter((r) => r.table_id === table.id);
      return !tableRes.some((r) => timesOverlap(r.time, altTime));
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

  const { rows } = await sql`SELECT * FROM reservations WHERE id = ${id}`;
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

  const { rows: updated } = await sql`SELECT * FROM reservations WHERE id = ${reservationId}`;
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
      SELECT * FROM reservations
      WHERE LOWER(guest_name) LIKE ${'%' + guestName.toLowerCase() + '%'} AND date = ${date} AND status = 'confirmed'
    `;
    return rows as Reservation[];
  }
  const { rows } = await sql`
    SELECT * FROM reservations
    WHERE LOWER(guest_name) LIKE ${'%' + guestName.toLowerCase() + '%'} AND status = 'confirmed'
  `;
  return rows as Reservation[];
}
