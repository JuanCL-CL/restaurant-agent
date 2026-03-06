import { NextRequest, NextResponse } from "next/server";
import {
  checkAvailability,
  createReservation,
  findReservation,
  cancelReservation,
  updateReservation,
  initDB,
} from "@/lib/db";
import { resolveTenant } from "@/lib/tenant";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseArgs(args: any): Record<string, any> {
  if (typeof args === "string") {
    try { return JSON.parse(args); } catch { return {}; }
  }
  return args || {};
}

function resolveRelativeDate(description: string): { date: string; spoken: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay();
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const lower = description.toLowerCase().trim();
  let target: Date | null = null;

  if (lower === "today") { target = today; }
  else if (lower === "tomorrow") { target = new Date(today); target.setDate(target.getDate() + 1); }
  else {
    const dayMap: Record<string, number> = { sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6 };
    let targetDay: number | null = null;
    let isNext = false;
    for (const [name, num] of Object.entries(dayMap)) {
      if (lower.includes(name)) { targetDay = num; isNext = lower.includes("next"); break; }
    }
    if (targetDay !== null) {
      let daysAhead = targetDay - dayOfWeek;
      if (daysAhead <= 0) daysAhead += 7;
      if (isNext) { daysAhead = targetDay - dayOfWeek; if (daysAhead <= 0) daysAhead += 7; if (daysAhead > 0 && daysAhead < 7) daysAhead += 7; }
      target = new Date(today); target.setDate(target.getDate() + daysAhead);
    }
  }
  if (!target) { const parsed = new Date(description); target = !isNaN(parsed.getTime()) ? parsed : today; }

  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  const dd = String(target.getDate()).padStart(2, "0");
  const ordinal = (n: number) => { const s = ["th","st","nd","rd"]; const v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]); };
  return { date: `${yyyy}-${mm}-${dd}`, spoken: `${dayNames[target.getDay()]}, ${monthNames[target.getMonth()]} ${ordinal(target.getDate())}` };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await initDB();
    const { slug } = await params;
    const restaurant = await resolveTenant(slug);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }
    const restaurantId = restaurant.id;

    const body = await req.json();
    const { message } = body;

    if (message?.type === "tool-calls") {
      const results = [];
      for (const toolCall of message.toolCallList || []) {
        const functionInfo = toolCall.function || toolCall;
        const name = functionInfo.name;
        const args = parseArgs(functionInfo.arguments);
        let result;

        switch (name) {
          case "resolve_date": {
            const resolved = resolveRelativeDate(args.description);
            result = { date: resolved.date, spoken: resolved.spoken, message: `The date is ${resolved.spoken} (${resolved.date}). Always say it as "${resolved.spoken}" to the caller.` };
            break;
          }
          case "check_availability": {
            const { date, time, party_size, section } = args;
            const availability = await checkAvailability(restaurantId, date, time, party_size, section);
            if (availability.available) {
              const secs = [...new Set(availability.tables.map((t) => t.section_name || t.section_id))];
              if (availability.sectionFallback && section) {
                result = { available: true, sectionFallback: true, message: `We don't have "${section}" seating available for ${party_size} guests, but we do have availability in: ${secs.join(", ")}. Ask if one of those would work instead.`, sections: secs };
              } else {
                result = { available: true, message: `Yes, we have availability for ${party_size} guests on ${date} at ${time}. Available sections: ${secs.join(", ")}.`, sections: secs };
              }
            } else {
              result = { available: false, message: `Sorry, we're fully booked for ${party_size} guests on ${date} at ${time}.`, alternativeTimes: availability.alternativeTimes,
                suggestion: availability.alternativeTimes?.length ? `We do have openings at: ${availability.alternativeTimes.join(", ")}. Would any of those work?` : "Unfortunately we don't have any nearby time slots available for that date." };
            }
            break;
          }
          case "make_reservation": {
            const { guest_name, party_size, date, time, special_requests, phone, section } = args;
            const reservation = await createReservation(restaurantId, guest_name, party_size, date, time, special_requests, phone, section);
            if ("error" in reservation) {
              result = { success: false, message: reservation.error, alternativeTimes: reservation.alternativeTimes };
            } else {
              const d = new Date(date + "T12:00:00");
              const dayNames2 = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
              const monthNames2 = ["January","February","March","April","May","June","July","August","September","October","November","December"];
              const ordinal2 = (n: number) => { const s = ["th","st","nd","rd"]; const v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]); };
              const spokenDate = `${dayNames2[d.getDay()]}, ${monthNames2[d.getMonth()]} ${ordinal2(d.getDate())}`;
              const [h, m] = time.split(":").map(Number);
              const ampm = h >= 12 ? "PM" : "AM";
              const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
              const spokenTime = m === 0 ? `${hour12} ${ampm}` : `${hour12}:${String(m).padStart(2,"0")} ${ampm}`;
              result = { success: true, message: `Reservation confirmed! Say this exactly to the caller: "${guest_name}, party of ${party_size}, on ${spokenDate} at ${spokenTime}." Do NOT say the date or time in any other format.`, reservationId: reservation.id };
            }
            break;
          }
          case "find_reservation": {
            const reservations = await findReservation(restaurantId, args.guest_name, args.date);
            result = reservations.length > 0
              ? { found: true, reservations: reservations.map((r) => ({ id: r.id, name: r.guest_name, partySize: r.party_size, date: r.date, time: r.time, specialRequests: r.special_requests })) }
              : { found: false, message: `I couldn't find a reservation under the name "${args.guest_name}".` };
            break;
          }
          case "update_reservation": {
            const { reservation_id, guest_name, party_size, date, time, special_requests } = args;
            const updates: Record<string, unknown> = {};
            if (guest_name) updates.guestName = guest_name;
            if (party_size) updates.partySize = party_size;
            if (date) updates.date = date;
            if (time) updates.time = time;
            if (special_requests !== undefined) updates.specialRequests = special_requests;
            const updated = await updateReservation(reservation_id, updates);
            result = "error" in updated ? { success: false, message: updated.error } : { success: true, message: `Reservation updated! Now under ${updated.guest_name}, party of ${updated.party_size}, on ${updated.date} at ${updated.time}.` };
            break;
          }
          case "cancel_reservation": {
            const success = await cancelReservation(args.reservation_id);
            result = { success, message: success ? "The reservation has been cancelled." : "I couldn't find that reservation to cancel." };
            break;
          }
          default: result = { error: `Unknown function: ${name}` };
        }
        results.push({ toolCallId: toolCall.id, result: JSON.stringify(result) });
      }
      return NextResponse.json({ results });
    }

    if (message?.type === "end-of-call-report") {
      console.log("Call ended:", { duration: message.endedReason, summary: message.summary });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Vapi webhook error:", error);
    return NextResponse.json({ error: "Internal server error", details: String(error) }, { status: 500 });
  }
}
