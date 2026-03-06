import { NextRequest, NextResponse } from "next/server";
import { createRestaurant, getRestaurantsByOwner, getRestaurantBySlug, setRestaurantVapiAssistant, getSettings, getSections, initDB } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createVapiAssistant, RestaurantContext } from "@/lib/vapi";

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
    if (name.trim().length > 50) {
      return NextResponse.json({ error: "Restaurant name must be 50 characters or less" }, { status: 400 });
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

    // Create a Vapi AI assistant with full restaurant context
    try {
      const baseUrl = process.env.AUTH_URL || "https://www.mesacall.com";
      const settings = await getSettings(restaurant.id);
      const sections = await getSections(restaurant.id);
      const ctx: RestaurantContext = {
        name: settings.name,
        phone: settings.phone || undefined,
        address: settings.address || undefined,
        openTime: settings.open_time,
        closeTime: settings.close_time,
        lastSeating: settings.last_seating || undefined,
        reservationDuration: settings.reservation_duration_minutes,
        sections: sections.map((s) => s.name),
      };
      const assistant = await createVapiAssistant(ctx, slug, baseUrl);
      await setRestaurantVapiAssistant(restaurant.id, assistant.id);
    } catch (err) {
      console.error("Failed to create Vapi assistant (restaurant still created):", err);
      // Non-fatal — restaurant is usable without AI agent, can retry later
    }

    return NextResponse.json({ restaurant, redirect: `/r/${restaurant.slug}` });
  } catch (error) {
    console.error("Onboarding POST error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
