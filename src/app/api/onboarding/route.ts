import { NextRequest, NextResponse } from "next/server";
import { createRestaurant, getRestaurantsByOwner, getRestaurantBySlug, setRestaurantVapiAssistant, initDB } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createVapiAssistant } from "@/lib/vapi";

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

    // Create a Vapi AI assistant for this restaurant
    try {
      const baseUrl = process.env.AUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://restaurant-agent-red.vercel.app";
      const assistant = await createVapiAssistant({ name: name.trim() }, slug, baseUrl);
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
