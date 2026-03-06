const fs = require('fs');
const { neon } = require('@neondatabase/serverless');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const pgMatch = envContent.match(/^POSTGRES_URL=(.+)$/m);
const pgUrl = pgMatch[1].replace(/"/g, '');
const sql = neon(pgUrl);

const prodEnv = fs.existsSync('.env.production') ? fs.readFileSync('.env.production', 'utf-8') : envContent;
const vapiMatch = prodEnv.match(/^VAPI_API_KEY=(.+)$/m);
const vapiKey = vapiMatch ? vapiMatch[1].replace(/"/g, '') : '';

function formatTime12h(time24) {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour12} ${ampm}` : `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

async function main() {
  // Simulate what onboarding does after createRestaurant
  const restaurantId = "test-for-template";
  
  console.log("1. Fetching settings...");
  const settings = await sql`SELECT * FROM restaurant_settings WHERE restaurant_id = ${restaurantId} LIMIT 1`;
  console.log("Settings result:", JSON.stringify(settings, null, 2));
  
  console.log("\n2. Fetching sections...");
  const sections = await sql`SELECT * FROM sections WHERE restaurant_id = ${restaurantId} ORDER BY display_order`;
  console.log("Sections result:", JSON.stringify(sections, null, 2));
  
  // Note: @neondatabase/serverless returns array directly, @vercel/postgres returns { rows: [] }
  // The production code uses @vercel/postgres
  const s = settings[0]; // neon returns array
  console.log("\n3. Building context with settings:", s?.name, s?.open_time, s?.close_time);
  
  if (!s) {
    console.error("ERROR: No settings found for restaurant!");
    return;
  }

  // Now try the Vapi call
  const webhookUrl = `https://www.mesacall.com/api/vapi/${restaurantId}`;
  const body = {
    name: `${s.name} - Mesa Agent`,
    firstMessage: `Hi, thanks for calling ${s.name}! How can I help you today?`,
    endCallFunctionEnabled: false,
    model: {
      model: "gpt-4o-mini",
      provider: "openai",
      messages: [{ role: "system", content: "Test prompt - this is a test" }],
      tools: [],
    },
    voice: { provider: "vapi", voiceId: "Kai" },
    serverUrl: webhookUrl,
    server: { url: webhookUrl, timeoutSeconds: 20 },
  };

  console.log("\n4. Creating Vapi assistant...");
  console.log("Using API key:", vapiKey.substring(0, 8) + "...");
  
  const resp = await fetch("https://api.vapi.ai/assistant", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${vapiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  console.log("Response status:", resp.status);
  const result = await resp.text();
  console.log("Response:", result.substring(0, 500));
}

main().catch(e => console.error("FATAL:", e));
