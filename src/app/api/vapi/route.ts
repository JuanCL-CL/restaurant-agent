import { NextRequest, NextResponse } from "next/server";
import {
  checkAvailability,
  createReservation,
  findReservation,
  cancelReservation,
  updateReservation,
} from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseArgs(args: any): Record<string, any> {
  if (typeof args === "string") {
    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }
  return args || {};
}

function resolveRelativeDate(description: string): { date: string; spoken: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  
  const lower = description.toLowerCase().trim();
  let target: Date | null = null;

  if (lower === "today") {
    target = today;
  } else if (lower === "tomorrow") {
    target = new Date(today);
    target.setDate(target.getDate() + 1);
  } else {
    // Handle "this X" or "next X" or just a day name
    const dayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    
    let targetDay: number | null = null;
    let isNext = false;
    
    for (const [name, num] of Object.entries(dayMap)) {
      if (lower.includes(name)) {
        targetDay = num;
        isNext = lower.includes("next");
        break;
      }
    }
    
    if (targetDay !== null) {
      let daysAhead = targetDay - dayOfWeek;
      if (daysAhead <= 0) daysAhead += 7;
      if (isNext && daysAhead <= 7) daysAhead += 7; // "next" means the week after
      // Actually, "next Friday" when today is Wednesday should be this coming Friday (2 days)
      // unless you interpret "next" as the one after "this". Common interpretation:
      // If today is Wed, "this Friday" = 2 days, "next Friday" = 9 days
      // But many people say "next Friday" to mean the coming Friday.
      // Let's use: if the day is within the current week (Sun-Sat), "next" means next week
      // Simple: "next" always adds 7 if the day hasn't passed yet this week
      if (isNext) {
        // Reset and calculate for next week's occurrence
        daysAhead = targetDay - dayOfWeek;
        if (daysAhead <= 0) daysAhead += 7;
        // If the day is still ahead this week, "next" means the following week
        if (daysAhead > 0 && daysAhead < 7) daysAhead += 7;
        // Edge case: if daysAhead was exactly 7 (same day next week), keep it
      }
      
      target = new Date(today);
      target.setDate(target.getDate() + daysAhead);
    }
  }
  
  if (!target) {
    // Try to parse as a date string
    const parsed = new Date(description);
    if (!isNaN(parsed.getTime())) {
      target = parsed;
    } else {
      // Return today as fallback
      target = today;
    }
  }
  
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  const dd = String(target.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;
  
  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  
  const spoken = `${dayNames[target.getDay()]}, ${monthNames[target.getMonth()]} ${ordinal(target.getDate())}`;
  
  return { date: dateStr, spoken };
}

// This endpoint is called by Vapi when the AI needs to check/make reservations
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message } = body;

    console.log("Vapi webhook received:", JSON.stringify({ type: message?.type }, null, 2));

    // Handle tool-calls from Vapi
    if (message?.type === "tool-calls") {
      const results = [];

      for (const toolCall of message.toolCallList || []) {
        const functionInfo = toolCall.function || toolCall;
        const name = functionInfo.name;
        const args = parseArgs(functionInfo.arguments);
        
        console.log(`Tool call: ${name}`, JSON.stringify(args));
        
        let result;

        switch (name) {
          case "resolve_date": {
            const { description } = args;
            const resolved = resolveRelativeDate(description);
            result = {
              date: resolved.date,
              spoken: resolved.spoken,
              message: `The date is ${resolved.spoken} (${resolved.date}). Always say it as "${resolved.spoken}" to the caller.`,
            };
            break;
          }

          case "check_availability": {
            const { date, time, party_size, section } = args;
            const availability = checkAvailability(date, time, party_size, section);

            if (availability.available) {
              const sections = [...new Set(availability.tables.map((t) => t.section))];
              result = {
                available: true,
                message: `Yes, we have availability for ${party_size} guests on ${date} at ${time}. Available sections: ${sections.join(", ")}.`,
                sections,
              };
            } else {
              result = {
                available: false,
                message: `Sorry, we're fully booked for ${party_size} guests on ${date} at ${time}.`,
                alternativeTimes: availability.alternativeTimes,
                suggestion:
                  availability.alternativeTimes && availability.alternativeTimes.length > 0
                    ? `We do have openings at: ${availability.alternativeTimes.join(", ")}. Would any of those work?`
                    : "Unfortunately we don't have any nearby time slots available for that date.",
              };
            }
            break;
          }

          case "make_reservation": {
            const { guest_name, party_size, date, time, special_requests, phone, section } = args;
            const reservation = createReservation(
              guest_name,
              party_size,
              date,
              time,
              special_requests,
              phone,
              section
            );

            if ("error" in reservation) {
              result = {
                success: false,
                message: reservation.error,
                alternativeTimes: reservation.alternativeTimes,
              };
            } else {
              result = {
                success: true,
                message: `Reservation confirmed! ${guest_name}, party of ${party_size}, on ${date} at ${time}.`,
                reservationId: reservation.id,
              };
            }
            break;
          }

          case "find_reservation": {
            const { guest_name, date } = args;
            const reservations = findReservation(guest_name, date);

            if (reservations.length > 0) {
              result = {
                found: true,
                reservations: reservations.map((r) => ({
                  id: r.id,
                  name: r.guestName,
                  partySize: r.partySize,
                  date: r.date,
                  time: r.time,
                  specialRequests: r.specialRequests,
                })),
              };
            } else {
              result = {
                found: false,
                message: `I couldn't find a reservation under the name "${guest_name}".`,
              };
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
            
            const updated = updateReservation(reservation_id, updates);
            if ("error" in updated) {
              result = { success: false, message: updated.error };
            } else {
              result = {
                success: true,
                message: `Reservation updated! Now under ${updated.guestName}, party of ${updated.partySize}, on ${updated.date} at ${updated.time}.`,
              };
            }
            break;
          }

          case "cancel_reservation": {
            const { reservation_id } = args;
            const success = cancelReservation(reservation_id);
            result = {
              success,
              message: success
                ? "The reservation has been cancelled."
                : "I couldn't find that reservation to cancel.",
            };
            break;
          }

          default:
            result = { error: `Unknown function: ${name}` };
        }

        results.push({
          toolCallId: toolCall.id,
          result: JSON.stringify(result),
        });
      }

      return NextResponse.json({ results });
    }

    // Handle end-of-call report
    if (message?.type === "end-of-call-report") {
      console.log("Call ended:", {
        duration: message.endedReason,
        summary: message.summary,
      });
      return NextResponse.json({ ok: true });
    }

    // Handle any other message types
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Vapi webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
