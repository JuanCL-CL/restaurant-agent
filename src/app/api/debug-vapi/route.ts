import { NextResponse } from "next/server";
import { getSettings, getSections, initDB } from "@/lib/db";
import { createVapiAssistant, RestaurantContext } from "@/lib/vapi";

export async function GET() {
  const slug = "second-test-for-vapi-agent";
  const baseUrl = process.env.AUTH_URL || "https://www.mesacall.com";
  
  try {
    await initDB();
    
    // Step 1: Get settings
    let settings;
    try {
      settings = await getSettings(slug);
    } catch (e) {
      return NextResponse.json({ step: "getSettings", error: String(e) });
    }
    
    // Step 2: Get sections
    let sections;
    try {
      sections = await getSections(slug);
    } catch (e) {
      return NextResponse.json({ step: "getSections", error: String(e) });
    }
    
    // Step 3: Build context
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
    
    // Step 4: Create Vapi assistant
    let assistant;
    try {
      assistant = await createVapiAssistant(ctx, slug, baseUrl);
    } catch (e) {
      return NextResponse.json({ 
        step: "createVapiAssistant", 
        error: String(e),
        ctx,
        baseUrl,
        vapiKeySet: !!process.env.VAPI_API_KEY,
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      assistantId: assistant.id,
      assistantName: assistant.name,
      ctx 
    });
  } catch (e) {
    return NextResponse.json({ step: "outer", error: String(e) });
  }
}
