import { NextRequest, NextResponse } from "next/server";
import { getCalls, isRestaurantOwner } from "@/lib/db";
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

    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50"), 100);
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");

    const { calls, total } = await getCalls(restaurant.id, limit, offset);

    return NextResponse.json({ calls, total, limit, offset });
  } catch (error) {
    console.error("Calls GET error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
