# ARCHITECTURE.md — TableCall Technical Reference

> **Purpose:** Single source of truth for the project's internals. If you're an AI agent (or future-me) picking this up cold, read this file first.
>
> **Maintenance:** Update this file whenever you change routes, DB schema, add integrations, or make architectural decisions. Check it's still accurate every few sessions.

---

## File Structure

```
src/
  app/
    page.tsx                          — Landing page (server component, smart routing)
    login/page.tsx                    — Google OAuth login
    onboarding/page.tsx               — Create restaurant flow
    auth/error/page.tsx               — Auth error auto-recovery (clears stale cookies)
    r/[slug]/page.tsx                 — Dashboard (per-restaurant, reservation view)
    r/[slug]/settings/page.tsx        — Settings + floorplan editor + AI agent + phone
    api/
      auth/[...nextauth]/route.ts     — NextAuth handler
      auth/clear/route.ts             — Cookie nuke endpoint (debug)
      onboarding/route.ts             — POST: create restaurant + sections + tables + Vapi agent
      my-restaurants/route.ts         — GET: list restaurants owned by current user
      r/[slug]/reservations/route.ts  — GET/PATCH/DELETE: reservation CRUD
      r/[slug]/settings/route.ts      — GET/PUT: restaurant settings (auto-syncs Vapi agent)
      r/[slug]/phone/route.ts         — GET: available numbers, POST: assign Twilio number
      r/[slug]/delete/route.ts        — DELETE: cascade-delete restaurant + Vapi assistant
      vapi/[slug]/route.ts            — POST: Vapi webhook (tool calls + end-of-call)
  components/
    FloorplanCanvas.tsx               — Drag/resize table editor + reservation view
                                        Touch-enabled (native events, not Pointer Events)
    RestaurantSwitcher.tsx            — Header dropdown (switch/add/delete restaurants)
    UserMenu.tsx                      — User avatar + sign-out dropdown
    Logo.tsx                          — SVG logo (table + speech bubble)
  lib/
    db.ts                             — All DB functions, types, schema init (tenant-scoped)
    auth.ts                           — NextAuth config (Google OAuth, prompt: select_account)
    tenant.ts                         — Slug → restaurant resolution (swap to subdomain later)
    vapi.ts                           — Vapi assistant creation/update, system prompt builder
    twilio.ts                         — Twilio number listing, Vapi phone import
  middleware.ts                       — Auth: protects /r/* routes, keeps webhooks + public routes open
```

## Database Schema (Neon Postgres)

```
users
  id TEXT PK (= email)
  email TEXT UNIQUE NOT NULL
  name TEXT
  image TEXT
  created_at TIMESTAMP

restaurants
  id TEXT PK (= slug)
  slug TEXT UNIQUE NOT NULL
  name TEXT NOT NULL
  owner_email TEXT
  vapi_assistant_id TEXT
  twilio_phone TEXT
  created_at TIMESTAMP

restaurant_settings
  restaurant_id TEXT PK → restaurants(id) CASCADE
  name TEXT NOT NULL DEFAULT 'My Restaurant'
  phone TEXT
  address TEXT
  open_time TEXT DEFAULT '11:00'
  close_time TEXT DEFAULT '22:00'
  last_seating TEXT DEFAULT '21:30'
  reservation_duration_minutes INTEGER DEFAULT 90

sections
  id TEXT PK
  restaurant_id TEXT NOT NULL → restaurants(id) CASCADE
  name TEXT NOT NULL
  description TEXT
  display_order INTEGER DEFAULT 0

tables
  id TEXT PK
  name TEXT NOT NULL
  capacity INTEGER NOT NULL
  section_id TEXT NOT NULL → sections(id) CASCADE
  restaurant_id TEXT NOT NULL → restaurants(id) CASCADE
  x, y, w, h DOUBLE PRECISION (floorplan layout, 0-100 percent)

reservations
  id TEXT PK
  restaurant_id TEXT NOT NULL → restaurants(id) CASCADE
  guest_name TEXT NOT NULL
  party_size INTEGER NOT NULL
  date TEXT NOT NULL (YYYY-MM-DD)
  time TEXT NOT NULL (HH:MM 24h)
  table_id TEXT NOT NULL
  special_requests TEXT
  phone TEXT
  status TEXT NOT NULL DEFAULT 'confirmed' ('confirmed' | 'cancelled')
  created_at TIMESTAMP
```

All tables cascade-delete from `restaurants`. Deleting a restaurant removes everything.

## Multi-Tenancy

- **Slug-based routing:** `/r/[slug]/...` for all tenant-scoped pages and APIs
- **Tenant resolution:** `tenant.ts` → `getRestaurantBySlug(slug)` — one function, one line change to switch to subdomains later
- **Owner auth:** `isRestaurantOwner(restaurantId, email)` on all `/api/r/[slug]/*` routes. Returns 403 if not owner. Restaurants with no `owner_email` allow any logged-in user (legacy fallback).

## Authentication

- **NextAuth v5** + Google OAuth
- `prompt: "select_account"` forces Google account picker (prevents auto-select)
- Middleware protects all routes except: `/`, `/login`, `/onboarding`, `/api/auth/*`, `/api/vapi/*`, `/auth/*`
- Custom `/auth/error` page auto-clears stale cookies and redirects to login
- Users auto-upserted on sign-in (non-fatal if DB errors)

### Known Issue: `AUTH_URL`

NextAuth REQUIRES the `AUTH_URL` env var on Vercel. Without it, NextAuth uses `VERCEL_URL` (which changes every deployment) as the OAuth redirect URI — new deploys break auth until cookies are cleared.

## Voice AI (Vapi)

### Flow
1. Customer calls restaurant's forwarded number → Twilio → Vapi
2. Vapi runs GPT-4o-mini with a context-aware system prompt
3. On tool calls, Vapi POSTs to `/api/vapi/[slug]`
4. Webhook resolves tenant, executes tool, returns result
5. AI speaks result to caller

### Tools (defined in `vapi.ts`, handled in webhook)
| Tool | Purpose |
|------|---------|
| `resolve_date` | Converts "next Friday", "tomorrow" → YYYY-MM-DD + spoken form |
| `check_availability` | Must call before confirming any reservation |
| `make_reservation` | Actually creates the booking |
| `find_reservation` | Lookup by guest name (fuzzy LIKE match) |
| `update_reservation` | Change name, date, time, party size, requests |
| `cancel_reservation` | Sets status to 'cancelled' |

### Key Design Decisions
- **GPT-4o-mini** — bigger models cause voice jitter (>500ms latency)
- **One question at a time** — never ask multiple questions in one turn
- **Spoken formats only** — all dates/times returned as "Friday, March 14th at 7 PM", never YYYY-MM-DD
- **Never fake tool calls** — strict enforcement rules in the prompt
- **`endCallFunctionEnabled: false`** — AI was hanging up prematurely
- **Fuzzy section matching** — "outside" → "Outdoor" via synonym map (outdoor/patio/terrace/etc.)
- **Section fallback** — if no tables in requested section, offers other sections
- **Auto-sync** — saving settings triggers `updateVapiAssistant()` with full restaurant context
- **Stable webhook URL** — must use `AUTH_URL` or hardcoded production URL, NOT `VERCEL_URL`

### Vapi API Gotcha
When PATCHing an assistant, sending `model.messages` without `model.tools` **WIPES the tools**. Always include both fields together.

## Telephony (Twilio)

- **Trial account** — plays "trial account" message before connecting ($20 to upgrade)
- Phone numbers imported into Vapi via `connectPhoneToVapi()`
- Vapi API changed April 2025: use `number` (E.164 like "+18482786810"), NOT `twilioPhoneNumber` (SID)
- Settings page shows available numbers + one-click assign
- Call forwarding guide with carrier-specific instructions (AT&T, Verizon, T-Mobile, VoIP)

## Floorplan Editor

- `FloorplanCanvas.tsx` — shared component for edit mode (settings) and view mode (dashboard)
- **Edit mode:** drag to move, corner handle to resize, save positions to DB
- **View mode:** click table for popover with today's reservations, color-coded (green=open, amber=booked)
- Chair SVGs with backrest, rotated to face the table
- Separate canvas per section with tab switcher
- Layout stored as percentages (0-100) for responsive rendering

### Mobile Touch (Critical Lesson)
Pointer Events + `setPointerCapture` are **unreliable on mobile Safari/Chrome**. Use:
- Native `onMouseDown`/`onTouchStart` on each element
- Global `window.addEventListener` for `mousemove`/`touchmove`/`mouseup`/`touchend`
- `touchmove` listener with `{ passive: false }` + `e.preventDefault()` to block scroll
- `touch-action: none` CSS on canvas and tables in edit mode
- Drag state in `useRef` (not `useState`) to avoid stale closures
- Inner content marked `pointer-events-none`
- Resize handle bumped to `w-8 h-8` for fat fingers

## Date/Timezone Handling

- **Server (Vercel):** Runs in UTC. All date resolution uses `toLocaleString("en-US", { timeZone: "America/New_York" })`
- **Dashboard:** Never use `toISOString().split("T")[0]` for local dates (shifts to UTC). Use `localDateStr()` helper
- **"Next Tuesday" logic:** First upcoming occurrence. `daysAhead ≤ 0 → add 7`. Don't add extra week for "next" prefix

## Credentials & Env Vars (Vercel)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | TableCall Google Cloud project |
| `GOOGLE_CLIENT_SECRET` | Google Cloud project |
| `AUTH_SECRET` | NextAuth encryption |
| `AUTH_TRUST_HOST` | NextAuth (set to `true`) |
| `AUTH_URL` | **Critical** — must be `https://www.mesacall.com` |
| `VAPI_API_KEY` | Vapi voice AI |
| `TWILIO_ACCOUNT_SID` | Twilio telephony |
| `TWILIO_AUTH_TOKEN` | Twilio telephony |
| `POSTGRES_URL` (+ variants) | Neon DB via Vercel integration |

Google Cloud project: "TableCall"
OAuth callback: `https://www.mesacall.com/api/auth/callback/google` (also keep old Vercel URL as fallback)

## Current State (as of 2026-03-06)

### Active Restaurants
- **MarJuans** (slug: `marjuans`, owner: mtess04)
- **JuansDemo** (slug: `juansdemo`, owner: jcl2129@googlemail.com)
- **Fen's Place** (slug: `fens-place`, owner: fen.johnsoncentral@gmail.com) — test restaurant

### What's Built ✅
- Full multi-tenant CRUD (create, settings, delete with cascade)
- Google OAuth with account picker + error auto-recovery
- Floorplan editor (drag/resize, touch-enabled, per-section tabs)
- AI voice agent per restaurant (auto-created, context-aware, auto-synced)
- Twilio phone assignment + call forwarding guide
- Dashboard: view reservations by date, edit, cancel
- Restaurant switcher + user menu (sign-out)
- Landing page with CTA
- Mobile responsive (headers, forms, floorplan, date picker)
- All pushed to GitHub (`JuanCL-CL/restaurant-agent`)

### What's Next 📋
- [ ] Public booking page (`/r/[slug]/book`)
- [ ] SMS notifications on new reservation
- [ ] Call history / transcripts
- [ ] Subdomain routing (one-line swap in `tenant.ts`)
- [ ] Custom domain (tablecall.com or similar)
- [ ] Upgrade Twilio from trial ($20)
- [ ] Migrate `@vercel/postgres` → `@neondatabase/serverless` (current dep is deprecated)

---

*Last updated: 2026-03-06 — generated from actual source code inspection*
