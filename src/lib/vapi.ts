const VAPI_API_KEY = process.env.VAPI_API_KEY || "";
const VAPI_BASE = "https://api.vapi.ai";

interface CreateAssistantResult {
  id: string;
  name: string;
}

export interface RestaurantContext {
  name: string;
  phone?: string;
  address?: string;
  openTime?: string;
  closeTime?: string;
  lastSeating?: string;
  reservationDuration?: number;
  sections?: string[];
}

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour12} ${ampm}` : `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function buildSystemPrompt(ctx: RestaurantContext): string {
  const name = ctx.name;
  const hours = ctx.openTime && ctx.closeTime
    ? `${formatTime12h(ctx.openTime)} to ${formatTime12h(ctx.closeTime)}`
    : "not specified";
  const lastSeating = ctx.lastSeating ? formatTime12h(ctx.lastSeating) : null;
  const address = ctx.address || "not specified";
  const phone = ctx.phone || "not specified";
  const sections = ctx.sections?.length ? ctx.sections.join(", ") : "Main Dining";
  const duration = ctx.reservationDuration || 60;

  return `You are a friendly, professional AI receptionist answering the phone at ${name}.
You sound warm, natural, and helpful — like a great front-of-house host. Callers may not know you're an AI, and that's fine. If asked directly, be honest: "I'm an AI assistant helping manage reservations for ${name}."

RESTAURANT INFO:
- Name: ${name}
- Address: ${address}
- Phone: ${phone}
- Hours: ${hours}${lastSeating ? `\n- Last seating: ${lastSeating}` : ""}
- Reservation slot: ${duration} minutes
- Dining areas: ${sections}

CONVERSATION STYLE — THIS IS CRITICAL:
- Ask ONE question at a time. Never combine multiple questions in one sentence.
- Wait for the caller's answer before moving on.
- Keep responses short — this is a phone call, not a text chat.
- Use the caller's name once you have it, but don't overuse it.
- Sound human: "Sure thing!", "Absolutely!", "Let me check on that."
- If the caller is chatty, be warm back. If they're in a hurry, be efficient.
- If the caller gives you multiple pieces of info at once (like "Friday, 7 PM, 4 people"), acknowledge ALL of it — don't re-ask what they already told you.

RESERVATION FLOW (follow this pacing):
1. Greet: "Hi, thanks for calling ${name}! How can I help you?"
2. "I'd be happy to help with a reservation. Can I get your name?"
3. (wait)
4. "Thanks, [name]. How many guests?"
5. (wait)
6. "And what date were you thinking?"
7. (wait — use resolve_date for any relative date like "Friday" or "next week")
8. "What time works best for you?"
9. (wait)
10. Check availability using the tool, then either confirm or suggest alternatives.
11. "Anything special we should know about — allergies, a celebration, seating preference?"
12. (wait)
13. Book it using make_reservation, then read back the confirmation exactly as the tool gives it.
14. "You're all set! We look forward to seeing you."

HANDLING COMMON QUESTIONS:
- Hours: "${name} is open ${hours}."${lastSeating ? ` Last seating is at ${lastSeating}.` : ""}
- Address/Location: "${address !== "not specified" ? `We're located at ${address}.` : "I don't have the exact address on hand, but you can find us on Google Maps!"}"
- Menu/dietary: "I don't have the full menu in front of me, but the kitchen is usually happy to accommodate dietary needs. Just let your server know when you arrive!"
- Parking: "I'd recommend checking Google Maps for nearby parking options."
- For anything you genuinely don't know, say: "That's a great question — I'd suggest giving us a call back during business hours so one of our team members can help with that." Don't make things up.

TOOL USAGE — CRITICAL:
- resolve_date: Use for ANY relative date ("next Friday", "tomorrow", "this Saturday"). Never guess dates.
- check_availability: You MUST call this BEFORE telling the caller a slot is available. No exceptions.
- make_reservation: You MUST call this to actually book. The reservation does NOT exist until this tool returns success.
- find_reservation: Use when someone wants to check or modify an existing booking.
- update_reservation / cancel_reservation: For changes and cancellations.

SPEAKING RULES:
- NEVER say dates as "YYYY-MM-DD" or numbers — say "Friday, March fourteenth"
- NEVER use 24-hour time — say "7 PM" not "19:00"
- NEVER read confirmation IDs, reservation IDs, or long numbers out loud
- If a tool gives you a "spoken" field, use it word-for-word
- When reading back alternative times, convert them: "6:30 PM, 7:30 PM, or 8 PM"

HOURS AWARENESS:
- If someone requests a time outside ${hours}, gently let them know: "We're open from ${hours}, so I wouldn't be able to book that time. Would you like to try a different time?"
${lastSeating ? `- If they request a time after ${lastSeating}: "Our last seating is at ${lastSeating}. Would an earlier time work?"` : ""}

NAME HANDLING — CRITICAL:
- Names can be misheard by the phone system. If a name sounds unusual, ask to confirm: "I want to make sure I have your name right — could you spell that for me?"
- If the caller corrects their name at ANY point, immediately call update_reservation to fix it in the system. Don't just acknowledge it verbally.

CALLER CORRECTIONS — NEVER ARGUE:
- If the caller corrects a date, time, name, or any detail — ACCEPT IT IMMEDIATELY. Do not push back.
- The caller knows better than you what date they want.
- Say something like "Got it, March tenth it is!" and move on.

ABSOLUTE RULES — NEVER BREAK THESE:
1. You MUST call check_availability before confirming ANY reservation.
2. You MUST call make_reservation to actually book. Never pretend you booked something.
3. If you say "let me check" — you MUST call a tool. Never fake it.
4. A reservation is NOT confirmed until make_reservation returns success.
5. Never make up information about the restaurant (menu, prices, specials, etc.)
6. Be honest if you don't know something.`;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "resolve_date",
      description: "Convert a relative date like 'next Friday', 'this Saturday', 'tomorrow' to an actual date. ALWAYS use this when the caller mentions a relative date.",
      parameters: {
        type: "object",
        required: ["description"],
        properties: { description: { type: "string", description: "The relative date description" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Check if tables are available. You MUST call this before confirming any reservation.",
      parameters: {
        type: "object",
        required: ["date", "time", "party_size"],
        properties: {
          date: { type: "string", description: "Date in YYYY-MM-DD format (get from resolve_date)" },
          time: { type: "string", description: "Time in HH:MM 24h format" },
          party_size: { type: "integer", description: "Number of guests" },
          section: { type: "string", description: "Preferred section" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "make_reservation",
      description: "Create a reservation. You MUST call this to actually book - never confirm without calling this. Only call AFTER check_availability returns available.",
      parameters: {
        type: "object",
        required: ["guest_name", "party_size", "date", "time"],
        properties: {
          guest_name: { type: "string", description: "Caller's name" },
          party_size: { type: "integer", description: "Number of guests" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          time: { type: "string", description: "Time in HH:MM 24h format" },
          phone: { type: "string", description: "Phone number if given" },
          section: { type: "string", description: "Section preference" },
          special_requests: { type: "string", description: "Special requests" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_reservation",
      description: "Look up an existing reservation by guest name",
      parameters: {
        type: "object",
        required: ["guest_name"],
        properties: {
          guest_name: { type: "string", description: "Name the reservation is under" },
          date: { type: "string", description: "Date to search (YYYY-MM-DD)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_reservation",
      description: "Cancel an existing reservation",
      parameters: {
        type: "object",
        required: ["reservation_id"],
        properties: { reservation_id: { type: "string", description: "Reservation ID to cancel" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_reservation",
      description: "Update an existing reservation (change name, date, time, party size, or special requests)",
      parameters: {
        type: "object",
        required: ["reservation_id"],
        properties: {
          reservation_id: { type: "string", description: "The reservation ID to update" },
          guest_name: { type: "string", description: "Updated guest name" },
          party_size: { type: "integer", description: "Updated party size" },
          date: { type: "string", description: "Updated date (YYYY-MM-DD)" },
          time: { type: "string", description: "Updated time (HH:MM)" },
          special_requests: { type: "string", description: "Updated special requests" },
        },
      },
    },
  },
];

// Voice fallback chain: ElevenLabs preferred → Vapi native as fallback
const VOICE_OPTIONS = [
  { provider: "11labs", model: "eleven_turbo_v2_5", voiceId: "ZncGbt9ecxkwpmaX6V9z", stability: 0.5, similarityBoost: 0.75 },
  { provider: "11labs", model: "eleven_turbo_v2_5", voiceId: "21m00Tcm4TlvDq8ikWAM", stability: 0.5, similarityBoost: 0.75 },
  { provider: "vapi", voiceId: "Kai" },
  { provider: "vapi", voiceId: "Clara" },
] as const;

export async function createVapiAssistant(
  ctx: RestaurantContext,
  slug: string,
  baseUrl: string
): Promise<CreateAssistantResult> {
  const webhookUrl = `${baseUrl}/api/vapi/${slug}`;

  const baseBody = {
    name: `${ctx.name.substring(0, 26)} - Mesa AI`,
    firstMessage: `Hi, thanks for calling ${ctx.name}! How can I help you today?`,
    endCallFunctionEnabled: false,
    endCallMessage: "Thank you for calling! We look forward to seeing you. Have a great day!",
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 300,
    model: {
      model: "gpt-4o-mini",
      provider: "openai",
      messages: [{ role: "system", content: buildSystemPrompt(ctx) }],
      tools: TOOLS,
    },
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en",
    },
    startSpeakingPlan: {
      smartEndpointingPlan: {
        provider: "livekit",
        waitFunction: "2000 / (1 + exp(-10 * (x - 0.5)))",
      },
      waitSeconds: 0.6,
    },
    stopSpeakingPlan: {
      numWords: 0,
      voiceSeconds: 0.2,
      backoffSeconds: 1.0,
    },
    serverUrl: webhookUrl,
    server: {
      url: webhookUrl,
      timeoutSeconds: 20,
    },
    serverMessages: ["end-of-call-report"],
  };

  // Try each voice in the fallback chain
  let lastError = "";
  for (const voice of VOICE_OPTIONS) {
    const body = { ...baseBody, voice };
    const res = await fetch(`${VAPI_BASE}/assistant`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      return { id: data.id, name: data.name };
    }

    const errText = await res.text();
    const isVoiceError =
      errText.includes("Couldn't Find") ||          // "Couldn't Find 11labs Voice"
      errText.includes("voice exists") ||            // "check the voice exists"
      errText.includes("11labs Voice") ||             // direct 11labs mention
      errText.includes("Voice not found");           // generic voice not found
    
    if (isVoiceError) {
      console.warn(`Voice ${voice.provider}/${voice.voiceId} failed, trying next fallback:`, errText);
      lastError = errText;
      continue;
    }

    // Non-voice error (e.g. name too long, auth issue) — don't retry
    throw new Error(`Vapi assistant creation failed: ${res.status} ${errText}`);
  }

  throw new Error(`All voice options exhausted. Last error: ${lastError}`);
}

export async function updateVapiAssistant(
  assistantId: string,
  ctx: RestaurantContext,
  slug: string,
  baseUrl: string
): Promise<void> {
  const webhookUrl = `${baseUrl}/api/vapi/${slug}`;

  const body = {
    name: `${ctx.name.substring(0, 26)} - Mesa AI`,
    firstMessage: `Hi, thanks for calling ${ctx.name}! How can I help you today?`,
    model: {
      model: "gpt-4o-mini",
      provider: "openai",
      messages: [{ role: "system", content: buildSystemPrompt(ctx) }],
      tools: TOOLS,
    },
    startSpeakingPlan: {
      smartEndpointingPlan: {
        provider: "livekit",
        waitFunction: "2000 / (1 + exp(-10 * (x - 0.5)))",
      },
      waitSeconds: 0.6,
    },
    stopSpeakingPlan: {
      numWords: 0,
      voiceSeconds: 0.2,
      backoffSeconds: 1.0,
    },
    serverUrl: webhookUrl,
    server: { url: webhookUrl, timeoutSeconds: 20 },
  };

  const res = await fetch(`${VAPI_BASE}/assistant/${assistantId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Vapi assistant update failed: ${res.status} ${errText}`);
  }
}
