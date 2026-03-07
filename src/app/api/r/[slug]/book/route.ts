import { NextRequest, NextResponse } from "next/server";
import { getSettings, getSections, getTables, getReservations, checkAvailability, createReservation } from "@/lib/db";
import { resolveTenant } from "@/lib/tenant";
import { sendReservationConfirmation } from "@/lib/twilio";

// GET: Public restaurant info + available time slots for a given date & party size
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const restaurant = await resolveTenant(slug);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const settings = await getSettings(restaurant.id);
    const sections = await getSections(restaurant.id);
    const tables = await getTables(restaurant.id);

    const date = req.nextUrl.searchParams.get("date");
    const partySize = parseInt(req.nextUrl.searchParams.get("partySize") || "2");
    const sectionPref = req.nextUrl.searchParams.get("section") || undefined;

    // Build restaurant public info
    const info = {
      name: settings.name || restaurant.name,
      phone: settings.phone || null,
      address: settings.address || null,
      openTime: settings.open_time,
      closeTime: settings.close_time,
      lastSeating: settings.last_seating,
      reservationDuration: settings.reservation_duration_minutes,
      sections: sections.map((s) => ({ id: s.id, name: s.name })),
      maxCapacity: tables.length > 0 ? Math.max(...tables.map((t) => t.capacity)) : 0,
    };

    // If no date requested, just return restaurant info
    if (!date) {
      return NextResponse.json({ restaurant: info });
    }

    // Generate available time slots for the requested date
    const openMins = timeToMinutes(settings.open_time);
    const lastMins = timeToMinutes(settings.last_seating);
    const slots: { time: string; available: boolean }[] = [];

    // Generate slots every 30 minutes from open to last seating
    for (let mins = openMins; mins <= lastMins; mins += 30) {
      const time = `${Math.floor(mins / 60).toString().padStart(2, "0")}:${(mins % 60).toString().padStart(2, "0")}`;
      const result = await checkAvailability(restaurant.id, date, time, partySize, sectionPref);
      // Only show as available if it doesn't require a section fallback
      slots.push({ time, available: result.available && !result.sectionFallback });
    }

    return NextResponse.json({ restaurant: info, slots, date, partySize });
  } catch (error) {
    console.error("Book GET error:", error);
    return NextResponse.json({ error: "Failed to load booking info" }, { status: 500 });
  }
}

// POST: Create a public reservation (no auth required)
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const restaurant = await resolveTenant(slug);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const { guestName, partySize, date, time, phone, specialRequests, section } = await req.json();

    // Validate required fields
    if (!guestName || !partySize || !date || !time) {
      return NextResponse.json({ error: "Please provide name, party size, date, and time." }, { status: 400 });
    }

    // Validate guest name length
    if (guestName.trim().length < 2 || guestName.trim().length > 100) {
      return NextResponse.json({ error: "Name must be between 2 and 100 characters." }, { status: 400 });
    }

    // Validate party size
    if (partySize < 1 || partySize > 20) {
      return NextResponse.json({ error: "Party size must be between 1 and 20." }, { status: 400 });
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date format." }, { status: 400 });
    }

    // Validate time format (HH:MM)
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json({ error: "Invalid time format." }, { status: 400 });
    }

    // Check date is not in the past
    const now = new Date();
    const estNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const bookingDate = new Date(date + "T23:59:59");
    if (bookingDate < new Date(estNow.toISOString().split("T")[0] + "T00:00:00")) {
      return NextResponse.json({ error: "Cannot book for a past date." }, { status: 400 });
    }

    // Check time is within operating hours
    const settings = await getSettings(restaurant.id);
    const requestedMins = timeToMinutes(time);
    const openMins = timeToMinutes(settings.open_time);
    const lastMins = timeToMinutes(settings.last_seating);
    if (requestedMins < openMins || requestedMins > lastMins) {
      return NextResponse.json({
        error: `Reservations are available between ${formatTime12h(settings.open_time)} and ${formatTime12h(settings.last_seating)}.`,
      }, { status: 400 });
    }

    // Auto-assign table (no manual table selection for public bookings)
    const result = await createReservation(
      restaurant.id,
      guestName.trim(),
      partySize,
      date,
      time,
      specialRequests?.trim() || undefined,
      phone?.trim() || undefined,
      section || undefined
    );

    if ("error" in result) {
      return NextResponse.json({
        error: result.error,
        alternativeTimes: result.alternativeTimes,
      }, { status: 409 });
    }

    // Send SMS confirmation if phone provided (non-blocking)
    if (phone?.trim()) {
      sendReservationConfirmation(
        phone.trim(),
        settings.name || restaurant.name,
        guestName.trim(),
        partySize,
        date,
        time,
        specialRequests?.trim()
      ).catch((err) => console.error("SMS confirmation failed (non-fatal):", err));
    }

    return NextResponse.json({
      reservation: {
        id: result.id,
        guestName: result.guest_name,
        partySize: result.party_size,
        date: result.date,
        time: result.time,
        sectionName: result.section_name,
        specialRequests: result.special_requests,
      },
      restaurant: {
        name: settings.name || restaurant.name,
        phone: settings.phone,
        address: settings.address,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Book POST error:", error);
    return NextResponse.json({ error: "Failed to create reservation" }, { status: 500 });
  }
}

// Helpers
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}
