import { NextRequest, NextResponse } from "next/server";
import {
  checkAvailability,
  createReservation,
  findReservation,
  cancelReservation,
  updateReservation,
  saveCall,
  initDB,
} from "@/lib/db";
import { resolveTenant } from "@/lib/tenant";

const VAPI_WEBHOOK_SECRET = process.env.VAPI_WEBHOOK_SECRET || "";

/** Convert 24h time to spoken format: "20:00" → "8 PM", "19:30" → "7:30 PM" */
function toSpokenTime(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour12} ${ampm}` : `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseArgs(args: any): Record<string, any> {
  if (typeof args === "string") {
    try { return JSON.parse(args); } catch { return {}; }
  }
  return args || {};
}

function resolveRelativeDate(description: string): { date: string; spoken: string } {
  // Use US Eastern time (restaurant's timezone) instead of UTC
  const nowStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const now = new Date(nowStr);
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
      // "next Tuesday" or just "Tuesday" both mean the first upcoming occurrence
      // Only skip to the week after if today IS that day (e.g. "next Tuesday" on a Tuesday = 7 days)
      if (daysAhead <= 0) daysAhead += 7;
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
    // Verify webhook secret from Vapi
    if (VAPI_WEBHOOK_SECRET) {
      const incomingSecret = req.headers.get("x-vapi-secret");
      if (incomingSecret !== VAPI_WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

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

            // Convert times to spoken format for AI
            const spokenTime = toSpokenTime(time);
            const spokenAlts = (availability.alternativeTimes || []).map(toSpokenTime);

            if (availability.available) {
              const secs = [...new Set(availability.tables.map((t) => t.section_name || t.section_id))];
              if (availability.sectionFallback && section) {
                result = { available: true, sectionFallback: true, message: `We don't have "${section}" seating available for ${party_size} guests, but we do have availability in: ${secs.join(", ")}. Ask if one of those would work instead.`, sections: secs };
              } else {
                result = { available: true, message: `Great news! We have a table for ${party_size} at ${spokenTime}. Available areas: ${secs.join(", ")}.`, sections: secs };
              }
            } else {
              const altMsg = spokenAlts.length ? `We do have openings at: ${spokenAlts.join(", ")}. Would any of those work?` : "Unfortunately we don't have any openings near that time on that date.";
              result = { available: false, message: `Sorry, we're fully booked for ${party_size} at ${spokenTime} on that date.`, alternativeTimesSpoken: spokenAlts, suggestion: altMsg };
            }
            break;
          }
          case "make_reservation": {
            const { guest_name, party_size, date, time, special_requests, phone, section } = args;
            // Auto-capture caller's phone number if AI didn't collect one explicitly
            const callerPhone = body.call?.customer?.number || null;
            const reservationPhone = phone || callerPhone || undefined;
            const reservation = await createReservation(restaurantId, guest_name, party_size, date, time, special_requests, reservationPhone, section);
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
            if (reservations.length > 0) {
              const formatted = reservations.map((r) => {
                const d = new Date(r.date + "T12:00:00");
                const dayNames3 = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
                const monthNames3 = ["January","February","March","April","May","June","July","August","September","October","November","December"];
                const ordinal3 = (n: number) => { const s = ["th","st","nd","rd"]; const v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]); };
                const spokenDate3 = `${dayNames3[d.getDay()]}, ${monthNames3[d.getMonth()]} ${ordinal3(d.getDate())}`;
                return { id: r.id, name: r.guest_name, partySize: r.party_size, spokenDate: spokenDate3, spokenTime: toSpokenTime(r.time), specialRequests: r.special_requests };
              });
              const first = formatted[0];
              result = { found: true, message: `Found a reservation for ${first.name}, party of ${first.partySize}, on ${first.spokenDate} at ${first.spokenTime}. Read this info naturally to the caller.`, reservations: formatted };
            } else {
              result = { found: false, message: `I couldn't find a reservation under the name "${args.guest_name}". Ask if they might have booked under a different name.` };
            }
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
      // Save call data to our database
      try {
        const callId = body.call?.id || message.callId || `unknown-${Date.now()}`;
        const startedAt = body.call?.startedAt || message.startedAt || null;
        const endedAt = body.call?.endedAt || message.endedAt || null;

        // Calculate duration
        let durationSeconds: number | undefined;
        if (startedAt && endedAt) {
          durationSeconds = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
        }

        // Extract transcript from messages array (exclude system prompts)
        const transcript = (message.messages || body.call?.messages || [])
          .filter((m: { role?: string; message?: string }) => m.role && m.message && m.role !== 'system')
          .map((m: { role: string; message: string }) => ({
            role: m.role === 'bot' || m.role === 'assistant' ? 'assistant' : m.role === 'user' ? 'caller' : m.role,
            text: m.message,
          }));

        await saveCall(restaurantId, callId, {
          callType: body.call?.type || message.type || null,
          callerPhone: body.call?.customer?.number || null,
          startedAt,
          endedAt,
          durationSeconds,
          endedReason: message.endedReason || body.call?.endedReason || null,
          summary: message.analysis?.summary || message.summary || null,
          transcript: transcript.length > 0 ? transcript : null,
          recordingUrl: message.recordingUrl || body.call?.recordingUrl || message.artifact?.recordingUrl || null,
          cost: message.cost || body.call?.cost || null,
        });
      } catch (err) {
        console.error("Failed to save call data (non-fatal):", err);
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Vapi webhook error:", error);
    return NextResponse.json({ error: "Internal server error", details: String(error) }, { status: 500 });
  }
}
