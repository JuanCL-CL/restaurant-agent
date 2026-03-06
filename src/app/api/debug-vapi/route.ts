import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.VAPI_API_KEY || "";
  const keySet = key.length > 0;
  const keyPrefix = key.substring(0, 8);
  
  // Try a simple Vapi API call
  let vapiStatus = "unknown";
  let vapiError = "";
  try {
    const res = await fetch("https://api.vapi.ai/assistant?limit=1", {
      headers: { Authorization: `Bearer ${key}` },
    });
    vapiStatus = `${res.status}`;
    if (!res.ok) {
      vapiError = await res.text();
    }
  } catch (err) {
    vapiStatus = "fetch-error";
    vapiError = String(err);
  }

  return NextResponse.json({
    keySet,
    keyPrefix: keySet ? keyPrefix + "..." : "(empty)",
    vapiStatus,
    vapiError: vapiError || null,
    authUrl: process.env.AUTH_URL || "(not set)",
  });
}
