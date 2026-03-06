import { NextRequest, NextResponse } from "next/server";
import { getReservations, getTables, getSections, isRestaurantOwner, updateReservation, cancelReservation } from "@/lib/db";
import { resolveTenant } from "@/lib/tenant";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const restaurant = await resolveTenant(slug);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const session = await auth();
    if (!session?.user?.email || !(await isRestaurantOwner(restaurant.id, session.user.email))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const date = req.nextUrl.searchParams.get("date") || undefined;
    const reservations = await getReservations(restaurant.id, date);
    const tables = await getTables(restaurant.id);
    const sections = await getSections(restaurant.id);

    return NextResponse.json({
      reservations,
      tables,
      sections,
      totalTables: tables.length,
      availableTables: tables.length - reservations.length,
    });
  } catch (error) {
    console.error("Error fetching reservations:", error);
    return NextResponse.json(
      { error: "Failed to fetch reservations", reservations: [], tables: [], sections: [] },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const restaurant = await resolveTenant(slug);
    if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const session = await auth();
    if (!session?.user?.email || !(await isRestaurantOwner(restaurant.id, session.user.email))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { reservationId, guestName, partySize, date, time, specialRequests } = await req.json();
    if (!reservationId) return NextResponse.json({ error: "Missing reservationId" }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (guestName !== undefined) updates.guestName = guestName;
    if (partySize !== undefined) updates.partySize = partySize;
    if (date !== undefined) updates.date = date;
    if (time !== undefined) updates.time = time;
    if (specialRequests !== undefined) updates.specialRequests = specialRequests;

    const result = await updateReservation(reservationId, updates);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ reservation: result });
  } catch (error) {
    console.error("Reservation PATCH error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const restaurant = await resolveTenant(slug);
    if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const session = await auth();
    if (!session?.user?.email || !(await isRestaurantOwner(restaurant.id, session.user.email))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { reservationId } = await req.json();
    if (!reservationId) return NextResponse.json({ error: "Missing reservationId" }, { status: 400 });

    const success = await cancelReservation(reservationId);
    if (!success) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reservation DELETE error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
