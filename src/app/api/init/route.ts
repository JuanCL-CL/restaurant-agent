import { NextResponse } from "next/server";
import { initDB } from "@/lib/db";

export async function GET() {
  try {
    await initDB();
    return NextResponse.json({ ok: true, message: "Database initialized" });
  } catch (error) {
    console.error("DB init error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
