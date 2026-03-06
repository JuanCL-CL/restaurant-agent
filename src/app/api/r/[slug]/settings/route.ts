import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings, getSections, createSection, updateSection, deleteSection, getTables, createTable, updateTable, deleteTable, isRestaurantOwner } from "@/lib/db";
import { resolveTenant } from "@/lib/tenant";
import { auth } from "@/lib/auth";
import { updateVapiAssistant } from "@/lib/vapi";
import type { Restaurant } from "@/lib/db";

/** Sync Vapi assistant prompt with latest restaurant settings (non-fatal) */
async function syncVapiAgent(restaurant: Restaurant) {
  if (!restaurant.vapi_assistant_id) return;
  try {
    const settings = await getSettings(restaurant.id);
    const sections = await getSections(restaurant.id);
    const baseUrl = process.env.AUTH_URL || "https://restaurant-agent-red.vercel.app";
    await updateVapiAssistant(
      restaurant.vapi_assistant_id,
      {
        name: settings.name || restaurant.name,
        phone: settings.phone,
        address: settings.address,
        openTime: settings.open_time,
        closeTime: settings.close_time,
        lastSeating: settings.last_seating,
        reservationDuration: settings.reservation_duration_minutes,
        sections: sections.map((s) => s.name),
      },
      restaurant.slug,
      baseUrl
    );
  } catch (err) {
    console.error("Failed to sync Vapi assistant (non-fatal):", err);
  }
}

async function checkOwner(restaurantId: string): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user?.email || !(await isRestaurantOwner(restaurantId, session.user.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const restaurant = await resolveTenant(slug);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const forbidden = await checkOwner(restaurant.id);
    if (forbidden) return forbidden;

    const settings = await getSettings(restaurant.id);
    const sections = await getSections(restaurant.id);
    const tables = await getTables(restaurant.id);
    return NextResponse.json({
      settings,
      sections,
      tables,
      restaurant: {
        slug: restaurant.slug,
        name: restaurant.name,
        vapi_assistant_id: restaurant.vapi_assistant_id || null,
        twilio_phone: restaurant.twilio_phone || null,
      },
    });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const restaurant = await resolveTenant(slug);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const forbidden = await checkOwner(restaurant.id);
    if (forbidden) return forbidden;

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "update_settings": {
        const result = await updateSettings(restaurant.id, body.settings);
        // Sync the AI agent prompt with the new settings
        await syncVapiAgent(restaurant);
        return NextResponse.json({ settings: result });
      }
      case "create_section": {
        const result = await createSection(restaurant.id, body.name, body.description);
        return NextResponse.json({ section: result });
      }
      case "update_section": {
        const result = await updateSection(body.id, body.name, body.description);
        return NextResponse.json({ section: result });
      }
      case "delete_section": {
        const success = await deleteSection(body.id);
        return NextResponse.json({ success });
      }
      case "create_table": {
        const result = await createTable(restaurant.id, body.name, body.capacity, body.section_id, {
          x: body.x, y: body.y, w: body.w, h: body.h,
        });
        return NextResponse.json({ table: result });
      }
      case "update_table": {
        const result = await updateTable(body.id, {
          name: body.name, capacity: body.capacity, sectionId: body.section_id,
          x: body.x, y: body.y, w: body.w, h: body.h,
        });
        return NextResponse.json({ table: result });
      }
      case "delete_table": {
        const success = await deleteTable(body.id);
        return NextResponse.json({ success });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Settings POST error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
