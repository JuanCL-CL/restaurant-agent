import { NextRequest, NextResponse } from "next/server";
import { getReservations, getTables } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get("date") || undefined;
    const reservations = await getReservations(date);
    const tables = await getTables();

    return NextResponse.json({
      reservations,
      tables,
      totalTables: tables.length,
      availableTables: tables.length - reservations.length,
    });
  } catch (error) {
    console.error("Error fetching reservations:", error);
    return NextResponse.json(
      { error: "Failed to fetch reservations", reservations: [], tables: [] },
      { status: 500 }
    );
  }
}
