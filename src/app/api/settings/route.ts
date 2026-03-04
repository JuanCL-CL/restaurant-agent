import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings, getSections, createSection, updateSection, deleteSection, getTables, createTable, updateTable, deleteTable } from "@/lib/db";

export async function GET() {
  try {
    const settings = await getSettings();
    const sections = await getSections();
    const tables = await getTables();
    return NextResponse.json({ settings, sections, tables });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "update_settings": {
        const result = await updateSettings(body.settings);
        return NextResponse.json({ settings: result });
      }
      case "create_section": {
        const result = await createSection(body.name, body.description);
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
        const result = await createTable(body.name, body.capacity, body.section_id);
        return NextResponse.json({ table: result });
      }
      case "update_table": {
        const result = await updateTable(body.id, body.name, body.capacity, body.section_id);
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
