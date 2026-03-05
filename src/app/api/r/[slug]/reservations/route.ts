import { NextRequest, NextResponse } from "next/server";
import { getReservations, getTables, getSections } from "@/lib/db";
import { resolveTenant } from "@/lib/tenant";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const restaurant = await resolveTenant(slug);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
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
