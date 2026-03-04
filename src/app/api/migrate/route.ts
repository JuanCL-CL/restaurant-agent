import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

// One-time migration to add new tables
export async function GET() {
  try {
    // Drop old tables that don't have the new schema
    await sql`DROP TABLE IF EXISTS reservations CASCADE`;
    await sql`DROP TABLE IF EXISTS tables CASCADE`;
    await sql`DROP TABLE IF EXISTS sections CASCADE`;
    await sql`DROP TABLE IF EXISTS restaurant_settings CASCADE`;

    // Re-import initDB to recreate everything fresh
    const { initDB } = await import("@/lib/db");
    await initDB();

    return NextResponse.json({ ok: true, message: "Database migrated and reseeded" });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
