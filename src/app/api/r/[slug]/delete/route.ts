import { NextRequest, NextResponse } from "next/server";
import { isRestaurantOwner, initDB } from "@/lib/db";
import { resolveTenant } from "@/lib/tenant";
import { auth } from "@/lib/auth";
import { sql } from "@vercel/postgres";

const VAPI_API_KEY = process.env.VAPI_API_KEY || "";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const restaurant = await resolveTenant(slug);
    if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const session = await auth();
    if (!session?.user?.email || !(await isRestaurantOwner(restaurant.id, session.user.email))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { confirm } = await req.json();
    if (confirm !== restaurant.name) {
      return NextResponse.json({ error: "Confirmation name does not match" }, { status: 400 });
    }

    await initDB();

    // Delete Vapi assistant if exists
    if (restaurant.vapi_assistant_id) {
      try {
        await fetch(`https://api.vapi.ai/assistant/${restaurant.vapi_assistant_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
        });
      } catch (err) {
        console.error("Failed to delete Vapi assistant (non-fatal):", err);
      }
    }

    // CASCADE deletes sections → tables, but reservations + settings need explicit delete
    await sql`DELETE FROM reservations WHERE restaurant_id = ${restaurant.id}`;
    await sql`DELETE FROM restaurant_settings WHERE restaurant_id = ${restaurant.id}`;
    await sql`DELETE FROM tables WHERE restaurant_id = ${restaurant.id}`;
    await sql`DELETE FROM sections WHERE restaurant_id = ${restaurant.id}`;
    await sql`DELETE FROM restaurants WHERE id = ${restaurant.id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete restaurant error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
