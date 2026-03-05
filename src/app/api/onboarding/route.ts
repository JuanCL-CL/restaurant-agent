import { NextRequest, NextResponse } from "next/server";
import { createRestaurant, getRestaurantsByOwner, getRestaurantBySlug, initDB } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initDB();
    const restaurants = await getRestaurantsByOwner(session.user.email);
    return NextResponse.json({ restaurants });
  } catch (error) {
    console.error("Onboarding GET error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initDB();
    const { name } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Restaurant name must be at least 2 characters" }, { status: 400 });
    }

    // Generate slug from name
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (slug.length < 2) slug = `restaurant-${Date.now()}`;

    // Ensure uniqueness
    const existing = await getRestaurantBySlug(slug);
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const restaurant = await createRestaurant(slug, name.trim(), session.user.email);
    return NextResponse.json({ restaurant, redirect: `/r/${restaurant.slug}` });
  } catch (error) {
    console.error("Onboarding POST error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
