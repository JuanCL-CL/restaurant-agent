import { NextRequest, NextResponse } from "next/server";
import { getReservations, getTables } from "@/lib/db";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || undefined;
  const reservations = getReservations(date);
  const tables = getTables();

  return NextResponse.json({
    reservations,
    tables,
    totalTables: tables.length,
    availableTables: tables.length - reservations.length,
  });
}
