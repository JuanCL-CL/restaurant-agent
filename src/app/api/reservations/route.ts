import { NextRequest, NextResponse } from "next/server";
import { getReservations, getTables, getSections, initDB } from "@/lib/db";

// Legacy route — serves "demo" restaurant for backward compat
export async function GET(req: NextRequest) {
  try {
    await initDB();
    const date = req.nextUrl.searchParams.get("date") || undefined;
    const reservations = await getReservations("demo", date);
    const tables = await getTables("demo");
    const sections = await getSections("demo");

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
