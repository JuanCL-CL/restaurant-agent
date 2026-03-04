import { NextRequest, NextResponse } from "next/server";
import {
  checkAvailability,
  createReservation,
  findReservation,
  cancelReservation,
} from "@/lib/db";

// This endpoint is called by Vapi when the AI needs to check/make reservations
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Vapi sends tool calls in this format
  const { message } = body;

  if (message?.type === "tool-calls") {
    const results = [];

    for (const toolCall of message.toolCallList || []) {
      const { name, arguments: args } = toolCall.function;
      let result;

      switch (name) {
        case "check_availability": {
          const { date, time, party_size, section } = JSON.parse(args);
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
          const { guest_name, party_size, date, time, special_requests, phone, section } =
            JSON.parse(args);
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
              message: `Reservation confirmed! ${guest_name}, party of ${party_size}, on ${date} at ${time}. Confirmation ID: ${reservation.id}.`,
              reservationId: reservation.id,
            };
          }
          break;
        }

        case "find_reservation": {
          const { guest_name, date } = JSON.parse(args);
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

        case "cancel_reservation": {
          const { reservation_id } = JSON.parse(args);
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
      transcript: message.transcript,
      summary: message.summary,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
