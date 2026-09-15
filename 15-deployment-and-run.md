# 15 — Deployment and Run

A judge must be able to clone the repo and reach a working demo in **under five minutes** with three commands. Treat that as a hard requirement; a setup that needs a support conversation loses points it will never recover.

## 1. Prerequisites

| Tool | Version | Note |
|---|---|---|
| Node | ≥ 20.11 | pinned in `.nvmrc` |
| npm | ≥ 10 | lockfile committed |
| Docker | any recent | for local Supabase |
| Supabase CLI | ≥ 1.180 | `npx supabase` is acceptable |

## 2. Five-minute start

```bash
git clone https://github.com/<you>/ward-proof-line
cd ward-proof-line
cp .env.example .env.local        # works as-is for local
npm install
npm run dev:full                  # starts supabase, applies migrations, seeds, starts next
```

Then open:

| URL | What |
|---|---|
| `http://localhost:3000/simulator` | Feature-phone simulator — **start here** |
| `http://localhost:3000/w/ET-AA-W09` | Public ward receipts |
| `http://localhost:3000/console` | Console (demo credentials in the README) |
| `http://localhost:3000/api/audit/verify?wardCode=ET-AA-W09` | Audit chain verifier |

`dev:full` is a script, not a sequence of instructions. If a judge has to run four commands in order, you have failed this file.

## 3. Scripts

```jsonc
{
  "dev": "next dev",
  "dev:full": "supabase start && supabase db reset && npm run seed:demo && next dev",
  "types:gen": "supabase gen types typescript --local > src/infra/db/types.gen.ts",
  "seed:demo": "tsx scripts/seed-demo.ts",
  "seed:reset": "supabase db reset && npm run seed:demo",
  "demo:travel": "tsx scripts/time-travel.ts --days 7",
  "cron:all": "tsx scripts/run-all-crons.ts",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "test:unit": "vitest run tests/unit",
  "test:adversarial": "vitest run tests/adversarial",
  "test:contract": "vitest run tests/contract",
  "test:e2e": "playwright test",
  "test:a11y": "playwright test tests/e2e/a11y.spec.ts",
  "verify:all": "npm run typecheck && npm run lint && npm run test:unit && npm run test:adversarial && npm run test:contract"
}
```

`demo:travel` and `cron:all` exist so the Day-7 probation moment can be shown live in 90 seconds. They are demo instruments and are **local-only** — guarded by `NODE_ENV !== 'production'` with a test asserting they refuse to run in production.

## 4. Environment variables

`.env.example` — committed, complete, with no real values.

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=           # local default printed by `supabase start`
SUPABASE_SERVICE_ROLE_KEY=               # server only — never referenced in client code

# Trust model secrets
PHONE_HASH_PEPPER=                       # HMAC pepper for phone_hash. Rotating it invalidates all clusters.
PHONE_ENC_KEY=                           # pgcrypto symmetric key for phone_enc

# Jobs
CRON_SECRET=                             # x-cron-secret header on all /api/cron/* routes

# Channels (all optional — the PoC runs fully on the simulator)
AT_API_KEY=
AT_USERNAME=
AT_SHORTCODE=*890#
CHANNEL_MODE=simulator                   # simulator | live

# Config
DEFAULT_COUNTRY=ET
DEFAULT_WARD=ET-AA-W09
DEFAULT_LOCALE=am
K_MIN_CLUSTERS=5                         # do not lower without reading 07 §7
WITNESS_TARGET=3
PROBATION_DAYS=7
VOICE_TTL_HOURS=48                       # hard ceiling enforced by a DB constraint regardless
```

Rules:
- A CI test asserts `SUPABASE_SERVICE_ROLE_KEY`, `PHONE_HASH_PEPPER` and `PHONE_ENC_KEY` never appear in any client bundle.
- A test asserts that `K_MIN_CLUSTERS < 5` and `VOICE_TTL_HOURS > 48` are both rejected at boot with a clear error. Trust parameters must not be silently weakenable by configuration.
- No secret is ever committed. `.env.local` is gitignored; `.env.example` is committed.

## 5. Seed scenario (exactly what `seed:demo` produces)

| Entity | State after seeding |
|---|---|
| Ward | `ET-AA-W09`, locales `am`, `om`, `en` |
| Project 4412 (generator) | `COMMITTED`, cited source page 41, ticket at `REPAIR_CLAIMED`, **2 of 3 witnesses recorded** — one short, so the demo's third submission completes it live |
| Project 4413 (borehole) | `PHYSICALLY_CONFIRMED`, sustained probation — the positive control |
| Project 4414 (latrine block) | `UNOFFICIAL_ESTIMATE`, no source document — shows the honest-absence state |
| Projects 4415–4417 | filler, so the receipt list looks like a real ward |
| Respondents | 12 across 4 clusters; **3 share one cluster**, which powers "second phone, same area" |
| Service `ET-ID-REPLACE` | 14 outcome reports across 6 clusters — **above k**, divergence visible |
| Service `ET-CLINIC-INTAKE` | 3 reports across 2 clusters — **below k**, suppression notice visible |
| Bulletin | one `DRAFT` awaiting approval |
| Audit chain | intact, verifier returns `ok: true` |

Seeding must be idempotent: running it twice produces the same state, not duplicates.

## 6. Hosted deployment

- **App:** Vercel. Preview deploys on every PR; production on `main`.
- **DB:** Supabase hosted project, migrations applied via CI on merge.
- **Cron:** `vercel.json` schedules hitting `/api/cron/*` with `x-cron-secret`.
- **Storage:** Supabase bucket `voice` — private, no public URLs, signed URLs ≤5 minutes.

```jsonc
// vercel.json
{
  "crons": [
    { "path": "/api/cron/flush-outbox",      "schedule": "*/5 * * * *" },
    { "path": "/api/cron/refresh-aggregates","schedule": "*/15 * * * *" },
    { "path": "/api/cron/purge-audio",       "schedule": "*/15 * * * *" },
    { "path": "/api/cron/probation-pings",   "schedule": "0 * * * *" },
    { "path": "/api/cron/close-probations",  "schedule": "0 * * * *" },
    { "path": "/api/cron/dispatch-tasks",    "schedule": "0 * * * *" },
    { "path": "/api/cron/bulletins-compile", "schedule": "0 6 * * 1" }
  ]
}
```

**Deploy the hosted version by end of Day 4.** A judge who can click a live link before reading the README is already predisposed to score you well — and finding a deploy bug on Day 5 with a video still to record is how submissions die.

## 7. Using the simulator

1. Open `/simulator`.
2. Pick a phone from the selector (each maps to a seeded respondent in a known cluster).
3. Dial `*890#` and navigate with the keypad. The transcript panel shows the literal HTTP payload.
4. **"Second phone, same area"** submits from a different MSISDN in the same cluster — this is the duplicate-suppression demo.
5. Toggle **IVR mode** to hear the same flow as audio.
6. The airplane-mode toggle lives on `/pwa`, not here — USSD needs no data, and conflating the two weakens the story.

## 8. Live channel mode (optional, P2)

Set `CHANNEL_MODE=live` and point an Africa's Talking sandbox USSD callback at `https://<deployment>/api/ussd`. No code changes — the endpoint already implements the gateway contract. If provisioning stalls, ship in simulator mode and say so plainly in the README: *"the endpoint implements the Africa's Talking USSD contract; the simulator and a live gateway send identical payloads."* That sentence is honest and costs nothing.

## 9. Troubleshooting (put this in the README too)

| Symptom | Cause | Fix |
|---|---|---|
| `supabase start` hangs | Docker not running | start Docker, retry |
| Types out of date after a migration | generated file is stale | `npm run types:gen` |
| Seed produces duplicates | seed script not idempotent | `npm run seed:reset` |
| Audit verifier returns a break | a manual DB edit | `supabase db reset && npm run seed:demo` |
| Audio silent in the simulator | missing files for the locale | check `/content/audio/manifest.json`; CH-04 should have caught it |
| Probation will not close in the demo | window has not elapsed | `npm run demo:travel -- --days 7 && npm run cron:all` |
