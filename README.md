# TableCall — AI-Powered Restaurant Reservations

**Multi-tenant SaaS** that gives any restaurant an AI phone receptionist in under 5 minutes.

A restaurant signs up, names their business, and gets:
- An **AI voice agent** that answers calls, takes reservations, and handles common questions
- A **dashboard** with floorplan editor, reservation management, and settings
- A **Twilio phone number** connected via call forwarding from their existing line

**Live:** https://restaurant-agent-red.vercel.app

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16 + React 19 + Tailwind 4 |
| Backend | Next.js API Routes (serverless on Vercel) |
| Database | Neon Postgres (via `@vercel/postgres`) |
| Auth | NextAuth v5 (Google OAuth) |
| Voice AI | Vapi (GPT-4o-mini + ElevenLabs + Deepgram) |
| Telephony | Twilio (trial — $20 to upgrade) |
| Hosting | Vercel |

## Quick Start (local dev)

```bash
cd restaurant-agent
npm install
npm run dev       # http://localhost:3000
```

Requires `.env.local` with: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `AUTH_URL`, `POSTGRES_URL`, `VAPI_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`.

All production env vars are set on Vercel.

## Deploy

```bash
npx vercel --yes --prod
```

## How It Works

1. **Visitor** hits `/` → landing page with CTA
2. **Signup** → Google OAuth → `/onboarding` → create restaurant (name + auto-slug)
3. **Onboarding** auto-creates: restaurant record, default settings, 3 sections (Indoor/Outdoor/Bar), 9 tables with floorplan positions, Vapi AI assistant with custom prompt
4. **Dashboard** (`/r/[slug]`) → view/edit/cancel reservations, color-coded by section
5. **Settings** (`/r/[slug]/settings`) → restaurant info, operating hours, floorplan editor (drag/resize), AI agent status, phone assignment, call forwarding guide
6. **Phone call** → Twilio → Vapi → AI talks to caller → webhook hits `/api/vapi/[slug]` → reservation created in DB → appears on dashboard

## Git & GitHub

- Repo: `JuanCL-CL/restaurant-agent` (private)
- Branch: `main`
- CLI: `gh` (HTTPS auth)

---

*For architecture details, DB schema, and technical decisions, see [ARCHITECTURE.md](./ARCHITECTURE.md).*
*Last updated: 2026-03-06*
