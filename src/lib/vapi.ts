const VAPI_API_KEY = process.env.VAPI_API_KEY || "";
const VAPI_BASE = "https://api.vapi.ai";

interface CreateAssistantResult {
  id: string;
  name: string;
}

function buildSystemPrompt(restaurantName: string): string {
  return `You are a friendly receptionist at ${restaurantName}. Help callers with reservations.

CONVERSATION STYLE - THIS IS CRITICAL:
- Ask ONE question at a time. Never combine multiple questions.
- Wait for the answer before asking the next question.
- Keep it natural - like a real human on the phone.
- Be warm but brief. This is a phone call, not a form.
- Introduce yourself: "Hi, thanks for calling ${restaurantName}! How can I help you?"

EXAMPLE FLOW (follow this pacing):
1. "Hi, thanks for calling ${restaurantName}! How can I help you?"
2. "Sure, I can help with a reservation. What's your name?"
3. (wait for answer)
4. "Great, thanks [name]. How many people?"
5. (wait for answer)
6. "And what date were you thinking?"
7. (wait for answer)
8. "What time works best?"
9. (wait for answer)
10. "Any special requests - allergies, birthday, seating preference?"
11. (wait for answer)
12. Check availability, then confirm or suggest alternatives.

BAD EXAMPLE (never do this):
"How many people, what date and time, and any special requests?" → TOO MANY QUESTIONS

TOOL USAGE:
- Use resolve_date for ANY relative date ("next Friday", "tomorrow")
- Use check_availability BEFORE confirming
- Use make_reservation to book - ONLY after you have name, party size, date, and time
- The make_reservation response will give you the exact words to confirm - read them as-is

SPEAKING RULES:
- NEVER say dates as YYYY-MM-DD - always natural: "Friday, March fourteenth"
- NEVER say times in 24h - say "7 PM" not "19:00"
- NEVER read confirmation IDs or long numbers
- If the caller corrects something, acknowledge it and fix it

ABSOLUTE RULES - NEVER BREAK THESE:
1. You MUST call check_availability before confirming ANY reservation. No exceptions.
2. You MUST call make_reservation to actually book it. Never pretend you booked something.
3. If you say "let me check" or "one moment" - you MUST call a tool. Never fake it.
4. A reservation is NOT confirmed until make_reservation returns success.
5. If you confirm without calling make_reservation, the reservation DOES NOT EXIST and the customer will show up to nothing.`;
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

export async function createVapiAssistant(
  restaurantName: string,
  slug: string,
  baseUrl: string
): Promise<CreateAssistantResult> {
  const webhookUrl = `${baseUrl}/api/vapi/${slug}`;

  const body = {
    name: `${restaurantName} - TableCall Agent`,
    firstMessage: `Hi, thanks for calling ${restaurantName}! How can I help you today?`,
    endCallFunctionEnabled: false,
    endCallMessage: "Thank you for calling! We look forward to seeing you. Have a great day!",
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 300,
    model: {
      model: "gpt-4o-mini",
      provider: "openai",
      messages: [{ role: "system", content: buildSystemPrompt(restaurantName) }],
      tools: TOOLS,
    },
    voice: {
      provider: "11labs",
      model: "eleven_turbo_v2_5",
      voiceId: "21m00Tcm4TlvDq8ikWAM",
      stability: 0.5,
      similarityBoost: 0.75,
    },
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en",
    },
    serverUrl: webhookUrl,
    server: {
      url: webhookUrl,
      timeoutSeconds: 20,
    },
    serverMessages: ["end-of-call-report"],
  };

  const res = await fetch(`${VAPI_BASE}/assistant`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Vapi assistant creation failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return { id: data.id, name: data.name };
}

export async function updateVapiAssistantName(
  assistantId: string,
  restaurantName: string,
  slug: string,
  baseUrl: string
): Promise<void> {
  const webhookUrl = `${baseUrl}/api/vapi/${slug}`;

  const body = {
    name: `${restaurantName} - TableCall Agent`,
    firstMessage: `Hi, thanks for calling ${restaurantName}! How can I help you today?`,
    model: {
      model: "gpt-4o-mini",
      provider: "openai",
      messages: [{ role: "system", content: buildSystemPrompt(restaurantName) }],
      tools: TOOLS,
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
