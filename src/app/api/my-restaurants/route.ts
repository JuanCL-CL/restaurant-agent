import { NextResponse } from "next/server";
import { getRestaurantsByOwner, initDB } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ restaurants: [] });
    }
    await initDB();
    const restaurants = await getRestaurantsByOwner(session.user.email);
    return NextResponse.json({ restaurants });
  } catch (error) {
    console.error("my-restaurants error:", error);
    return NextResponse.json({ restaurants: [] });
  }
}
