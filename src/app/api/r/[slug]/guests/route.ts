import { NextRequest, NextResponse } from "next/server";
import { getGuests, getGuestById, getGuestReservations, updateGuest, isRestaurantOwner } from "@/lib/db";
import { resolveTenant } from "@/lib/tenant";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const restaurant = await resolveTenant(slug);
    if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

    const session = await auth();
    if (!session?.user?.email || !(await isRestaurantOwner(restaurant.id, session.user.email))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const guestId = req.nextUrl.searchParams.get("id");

    // Single guest detail with reservation history
    if (guestId) {
      const guest = await getGuestById(guestId);
      if (!guest || guest.restaurant_id !== restaurant.id) {
        return NextResponse.json({ error: "Guest not found" }, { status: 404 });
      }
      const reservations = await getGuestReservations(guestId);
      return NextResponse.json({ guest, reservations });
    }

    // Guest list
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");
    const sort = (req.nextUrl.searchParams.get("sort") || "recent") as "visits" | "recent" | "name";

    const result = await getGuests(restaurant.id, { limit, offset, sort });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Guests GET error:", error);
    return NextResponse.json({ error: "Failed to fetch guests" }, { status: 500 });
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

    const { guestId, name, email, notes, tags } = await req.json();
    if (!guestId) return NextResponse.json({ error: "Missing guestId" }, { status: 400 });

    // Verify guest belongs to this restaurant
    const existing = await getGuestById(guestId);
    if (!existing || existing.restaurant_id !== restaurant.id) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    const updates: { name?: string; email?: string; notes?: string; tags?: string } = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (notes !== undefined) updates.notes = notes;
    if (tags !== undefined) updates.tags = tags;

    const guest = await updateGuest(guestId, updates);
    return NextResponse.json({ guest });
  } catch (error) {
    console.error("Guests PATCH error:", error);
    return NextResponse.json({ error: "Failed to update guest" }, { status: 500 });
  }
}
