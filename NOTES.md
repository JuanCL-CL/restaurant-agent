# TableCall - Dev Notes

## Vapi Webhook Format

When Vapi calls our server with a tool call, the payload looks like:
```json
{
  "message": {
    "type": "tool-calls",
    "toolCallList": [
      {
        "id": "call_abc123",
        "function": {
          "name": "check_availability",
          "arguments": "{\"date\": \"2026-03-06\", \"time\": \"19:00\", \"party_size\": 3}"
        }
      }
    ]
  }
}
```

**Important:** `arguments` is a JSON STRING, not an object. Must `JSON.parse()` it.

**CRITICAL:** When PATCHing the assistant's `model` field, you MUST include `model.tools` alongside `model.messages`. If you only send `messages`, Vapi wipes `tools` to empty. Always read the current assistant first and preserve tools.

Response format:
```json
{
  "results": [
    {
      "toolCallId": "call_abc123",
      "result": "{\"available\": true, ...}"  
    }
  ]
}
```

**`result` must also be a JSON string.**

## Voice AI Lessons

- GPT-4o-mini is the sweet spot for voice — fast enough (~200-500ms) for natural conversation
- Bigger models (GPT-4o, GPT-5.x) cause noticeable pauses/jitter
- Never return raw YYYY-MM-DD dates — AI reads them digit by digit
- Never return long IDs — AI reads them digit by digit  
- Always provide "spoken" versions of data alongside machine-readable versions
- LLMs cannot do date math reliably — use server-side resolve_date tool
- Ask ONE question at a time — never combine "how many, when, what time?" in one breath
- AI will sometimes fake tool calls (say "let me check" but not actually call the tool) — must add explicit rules forbidding this
- Disable endCallFunctionEnabled — AI was hanging up mid-conversation
- Return spoken confirmation in make_reservation result so AI reads it verbatim

## Vercel Deployment

- `npx vercel --yes --prod` from project root
- In-memory data resets on every deploy
- Need persistent database (Vercel Postgres is free tier)

## Current Architecture

```
Caller → Phone → Vapi (STT + AI + TTS)
                    ↓ (tool calls)
              Vercel API (/api/vapi)
                    ↓
              In-memory DB (db.ts)
                    
Dashboard → Vercel (/api/reservations) → Same DB
```
