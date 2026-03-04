// Simple in-memory database for MVP — swap for a real DB later
// Each restaurant has tables and reservations

export interface Table {
  id: string;
  name: string;
  capacity: number;
  section: "indoor" | "outdoor" | "bar" | "private";
}

export interface Reservation {
  id: string;
  guestName: string;
  partySize: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  tableId: string;
  specialRequests?: string;
  phone?: string;
  status: "confirmed" | "cancelled";
  createdAt: string;
}

// Default restaurant tables
const tables: Table[] = [
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

// In-memory reservations store
const reservations: Reservation[] = [
  // Seed with a few sample reservations
  {
    id: "r1",
    guestName: "Smith Family",
    partySize: 4,
    date: "2026-03-04",
    time: "19:00",
    tableId: "t3",
    status: "confirmed",
    createdAt: new Date().toISOString(),
  },
  {
    id: "r2",
    guestName: "Johnson",
    partySize: 2,
    date: "2026-03-04",
    time: "19:00",
    tableId: "t1",
    status: "confirmed",
    createdAt: new Date().toISOString(),
  },
];

// Reservation duration in hours (assumed 1.5 hours per reservation)
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

export function getTables(): Table[] {
  return tables;
}

export function getReservations(date?: string): Reservation[] {
  if (date) {
    return reservations.filter((r) => r.date === date && r.status === "confirmed");
  }
  return reservations.filter((r) => r.status === "confirmed");
}

export function checkAvailability(
  date: string,
  time: string,
  partySize: number,
  section?: string
): { available: boolean; tables: Table[]; alternativeTimes?: string[] } {
  // Find tables that can fit the party
  let suitableTables = tables.filter((t) => t.capacity >= partySize);

  // Filter by section if requested
  if (section) {
    suitableTables = suitableTables.filter((t) => t.section === section);
  }

  // Find which tables are booked at the requested time
  const dateReservations = reservations.filter(
    (r) => r.date === date && r.status === "confirmed"
  );

  const availableTables = suitableTables.filter((table) => {
    const tableReservations = dateReservations.filter((r) => r.tableId === table.id);
    return !tableReservations.some((r) => timesOverlap(r.time, time));
  });

  if (availableTables.length > 0) {
    return { available: true, tables: availableTables };
  }

  // Suggest alternative times (check 30-min increments around requested time)
  const requestedMins = timeToMinutes(time);
  const alternativeTimes: string[] = [];
  
  for (const offset of [-60, -30, 30, 60, 90, 120]) {
    const altMins = requestedMins + offset;
    if (altMins < 660 || altMins > 1290) continue; // 11 AM to 9:30 PM
    
    const altTime = `${Math.floor(altMins / 60).toString().padStart(2, "0")}:${(altMins % 60).toString().padStart(2, "0")}`;
    
    const altAvailable = suitableTables.some((table) => {
      const tableReservations = dateReservations.filter((r) => r.tableId === table.id);
      return !tableReservations.some((r) => timesOverlap(r.time, altTime));
    });
    
    if (altAvailable) {
      alternativeTimes.push(altTime);
    }
  }

  return { available: false, tables: [], alternativeTimes };
}

export function createReservation(
  guestName: string,
  partySize: number,
  date: string,
  time: string,
  specialRequests?: string,
  phone?: string,
  preferredSection?: string
): Reservation | { error: string; alternativeTimes?: string[] } {
  const availability = checkAvailability(date, time, partySize, preferredSection);

  if (!availability.available) {
    return {
      error: `No tables available for a party of ${partySize} on ${date} at ${time}.`,
      alternativeTimes: availability.alternativeTimes,
    };
  }

  // Pick the smallest suitable available table
  const table = availability.tables.sort((a, b) => a.capacity - b.capacity)[0];

  const reservation: Reservation = {
    id: `r${Date.now()}`,
    guestName,
    partySize,
    date,
    time,
    tableId: table.id,
    specialRequests,
    phone,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };

  reservations.push(reservation);
  return reservation;
}

export function cancelReservation(reservationId: string): boolean {
  const reservation = reservations.find((r) => r.id === reservationId);
  if (reservation) {
    reservation.status = "cancelled";
    return true;
  }
  return false;
}

export function findReservation(guestName: string, date?: string): Reservation[] {
  return reservations.filter(
    (r) =>
      r.guestName.toLowerCase().includes(guestName.toLowerCase()) &&
      r.status === "confirmed" &&
      (!date || r.date === date)
  );
}
