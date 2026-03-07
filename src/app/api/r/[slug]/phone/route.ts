import { NextRequest, NextResponse } from "next/server";
import { isRestaurantOwner, initDB } from "@/lib/db";
import { resolveTenant } from "@/lib/tenant";
import { auth } from "@/lib/auth";
import { listTwilioNumbers, connectPhoneToVapi, disconnectPhoneFromVapi } from "@/lib/twilio";
import { sql } from "@vercel/postgres";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const restaurant = await resolveTenant(slug);
    if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const session = await auth();
    if (!session?.user?.email || !(await isRestaurantOwner(restaurant.id, session.user.email))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // List available Twilio numbers
    const numbers = await listTwilioNumbers();

    // Check which are already assigned to other restaurants
    await initDB();
    const { rows: assigned } = await sql`SELECT twilio_phone FROM restaurants WHERE twilio_phone IS NOT NULL`;
    const assignedNumbers = new Set(assigned.map((r) => r.twilio_phone));

    const available = numbers.map((n) => ({
      ...n,
      assigned: assignedNumbers.has(n.phoneNumber),
      assignedToThis: restaurant.twilio_phone === n.phoneNumber,
    }));

    return NextResponse.json({
      numbers: available,
      currentPhone: restaurant.twilio_phone || null,
    });
  } catch (error) {
    console.error("Phone GET error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const restaurant = await resolveTenant(slug);
    if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const session = await auth();
    if (!session?.user?.email || !(await isRestaurantOwner(restaurant.id, session.user.email))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!restaurant.vapi_assistant_id) {
      return NextResponse.json({ error: "No AI agent configured. Create one first." }, { status: 400 });
    }

    const { phoneNumber, phoneNumberSid } = await req.json();

    // Connect in Vapi (pass E.164 number, not SID)
    await connectPhoneToVapi(phoneNumber, restaurant.vapi_assistant_id);

    // Save to DB
    await initDB();
    await sql`UPDATE restaurants SET twilio_phone = ${phoneNumber} WHERE id = ${restaurant.id}`;

    return NextResponse.json({ success: true, phoneNumber });
  } catch (error) {
    console.error("Phone POST error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const restaurant = await resolveTenant(slug);
    if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const session = await auth();
    if (!session?.user?.email || !(await isRestaurantOwner(restaurant.id, session.user.email))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!restaurant.twilio_phone) {
      return NextResponse.json({ error: "No phone number assigned" }, { status: 400 });
    }

    // Disconnect from Vapi (clear assistantId on the phone number)
    await disconnectPhoneFromVapi(restaurant.twilio_phone);

    // Clear from DB
    await initDB();
    await sql`UPDATE restaurants SET twilio_phone = NULL WHERE id = ${restaurant.id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Phone DELETE error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
