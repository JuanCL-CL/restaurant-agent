const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const VAPI_API_KEY = process.env.VAPI_API_KEY || "";
const MESA_SMS_FROM = process.env.MESA_SMS_FROM || ""; // Twilio number to send SMS from (E.164)

function authHeader(): string {
  return "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64");
}

export interface TwilioNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
}

/** List all phone numbers on the Twilio account */
export async function listTwilioNumbers(): Promise<TwilioNumber[]> {
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json?PageSize=50`,
    { headers: { Authorization: authHeader() } }
  );
  if (!res.ok) throw new Error(`Twilio list failed: ${res.status}`);
  const data = await res.json();
  return (data.incoming_phone_numbers || []).map((n: { sid: string; phone_number: string; friendly_name: string }) => ({
    sid: n.sid,
    phoneNumber: n.phone_number,
    friendlyName: n.friendly_name,
  }));
}

/** Disconnect a phone number from its Vapi assistant (clear the assistantId). */
export async function disconnectPhoneFromVapi(phoneNumber: string): Promise<void> {
  const listRes = await fetch("https://api.vapi.ai/phone-number?limit=50", {
    headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
  });

  if (!listRes.ok) return; // If we can't list, just clear the DB side

  const numbers = await listRes.json();
  const existing = numbers.find?.((n: { number?: string }) => n.number === phoneNumber);
  if (!existing) return; // Number not in Vapi, nothing to disconnect

  const updateRes = await fetch(`https://api.vapi.ai/phone-number/${existing.id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ assistantId: null }),
  });

  if (!updateRes.ok) {
    const err = await updateRes.text();
    console.warn(`Vapi phone disconnect warning: ${updateRes.status} ${err}`);
    // Don't throw — we still want to clear the DB side even if Vapi fails
  }
}

/** Import a phone number into Vapi and connect it to an assistant.
 *  `phoneNumber` must be E.164 format (e.g. +18482786810).
 *  `phoneNumberSid` is the Twilio SID (kept for legacy lookup). */
export async function connectPhoneToVapi(
  phoneNumber: string,
  vapiAssistantId: string
): Promise<string> {
  // First check if this number is already imported in Vapi
  const listRes = await fetch("https://api.vapi.ai/phone-number?limit=50", {
    headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
  });

  if (listRes.ok) {
    const numbers = await listRes.json();
    // Match by E.164 number (Vapi stores it in the `number` field)
    const existing = numbers.find?.((n: { number?: string }) => n.number === phoneNumber);
    if (existing) {
      // Update the assistant on the existing Vapi phone number
      const updateRes = await fetch(`https://api.vapi.ai/phone-number/${existing.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assistantId: vapiAssistantId }),
      });
      if (!updateRes.ok) {
        const err = await updateRes.text();
        throw new Error(`Vapi phone update failed: ${updateRes.status} ${err}`);
      }
      return existing.id;
    }
  }

  // Import the Twilio number into Vapi (new API format as of April 2025)
  const importRes = await fetch("https://api.vapi.ai/phone-number", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "twilio",
      number: phoneNumber,
      twilioAccountSid: TWILIO_SID,
      twilioAuthToken: TWILIO_TOKEN,
      assistantId: vapiAssistantId,
    }),
  });

  if (!importRes.ok) {
    const err = await importRes.text();
    throw new Error(`Vapi phone import failed: ${importRes.status} ${err}`);
  }

  const data = await importRes.json();
  return data.id;
}

/** Format 24h time to spoken: "19:00" → "7:00 PM" */
function formatTimeSMS(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour12} ${ampm}` : `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Format date to readable: "2026-03-13" → "Friday, March 13th" */
function formatDateSMS(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const ordinal = (n: number) => { const s = ["th","st","nd","rd"]; const v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]); };
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${ordinal(d.getDate())}`;
}

/** Send an SMS via Twilio */
export async function sendSMS(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  // Use MESA_SMS_FROM or fall back to first Twilio number
  let from = MESA_SMS_FROM;
  if (!from) {
    try {
      const numbers = await listTwilioNumbers();
      if (numbers.length > 0) from = numbers[0].phoneNumber;
    } catch { /* ignore */ }
  }
  if (!from) {
    return { success: false, error: "No Twilio phone number available to send from" };
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      console.error("Twilio SMS error:", data);
      return { success: false, error: data.message || `Twilio error ${res.status}` };
    }

    return { success: true, sid: data.sid };
  } catch (err) {
    console.error("SMS send failed:", err);
    return { success: false, error: String(err) };
  }
}

/** Send a reservation confirmation SMS */
export async function sendReservationConfirmation(
  to: string,
  restaurantName: string,
  guestName: string,
  partySize: number,
  date: string,
  time: string,
  specialRequests?: string
): Promise<{ success: boolean; error?: string }> {
  const dateFormatted = formatDateSMS(date);
  const timeFormatted = formatTimeSMS(time);

  let message = `✅ Reservation Confirmed!\n\n`;
  message += `${restaurantName}\n`;
  message += `📋 ${guestName}, party of ${partySize}\n`;
  message += `📅 ${dateFormatted}\n`;
  message += `🕐 ${timeFormatted}\n`;
  if (specialRequests) {
    message += `📝 ${specialRequests}\n`;
  }
  message += `\nWe look forward to seeing you!`;
  message += `\n\n— Powered by Mesa`;

  return sendSMS(to, message);
}
