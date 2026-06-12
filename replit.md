# Nexus AI — Telegram AI Autonomous System

A professional command-center dashboard for managing AI-powered Telegram accounts that behave like intelligent humans. Multi-account automation, AI content generation, human behavior simulation, anti-ban protection, and real-time security monitoring.

## Run & Operate

- `pnpm --filter @workspace/dashboard run dev` — run the frontend dashboard (port 23183, preview at `/`)
- `pnpm --filter @workspace/api-server run dev` — run the Node.js API server (port 8080, at `/api`)
- `python python-backend/main.py` — run the Python Telethon engine (port 8090)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (Node.js)
- Python Engine: FastAPI + Uvicorn + Telethon (Telegram MTProto client)
- DB: PostgreSQL + Drizzle ORM
- Frontend: React + Vite + shadcn/ui + Recharts
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/` — Drizzle schema files (accounts, groups, channels, messages, campaigns, schedules, ai, security, notifications)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/dashboard/src/pages/` — React dashboard pages
- `python-backend/main.py` — Telethon engine + anti-ban + AI generation

## Architecture decisions

- Contract-first API: OpenAPI spec drives Zod validation + React Query hooks via Orval codegen
- Node.js handles all REST API (CRUD, analytics, auth) — Python handles Telegram MTProto via Telethon
- Human behavior simulation: gaussian-distributed delays, typing time calculation, safe interval management based on message volume
- Anti-ban: accounts track healthScore (0-100), FloodWait events reduce score and trigger cooldown status
- AI generation: OpenAI GPT-4o primary, Gemini fallback, template fallback for no-key mode
- Target groups/channels stored as JSON strings in DB text columns (campaigns table)

## Product

- **Dashboard**: Live telemetry — accounts, AI messages, active campaigns, security threats
- **Accounts**: Manage Telegram accounts with health scores, connect/disconnect via OTP
- **Groups & Channels**: Auto-reply, auto-moderate, auto-post toggles
- **Messages**: Full message log with inbound/outbound, AI-generated badge, send form
- **Campaigns**: Campaign lifecycle (draft → active → paused → completed) with targeting
- **Schedules**: Cron-based schedule manager for automated campaign execution
- **AI Engine**: Personality profiles, content generator (OpenAI/Gemini/template), activity logs
- **Security**: Threat detection log, sanctions manager (ban/mute/warn/kick)
- **Analytics**: 7-day activity chart, per-group engagement statistics
- **Notifications**: System alert feed with read/unread state

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm run typecheck:libs` before api-server typecheck after adding new DB schema files — stale declarations cause false errors
- Campaigns: `targetGroups`/`targetChannels` stored as JSON strings in text columns, deserialized in routes
- Date columns (startDate, endDate, expiresAt): Zod parses as strings, must convert to `new Date()` before Drizzle insert/update
- Python backend needs TELEGRAM_API_ID + TELEGRAM_API_HASH + DATABASE_URL to connect real accounts
- Port 23183 may be occupied by a previous Vite process — run `fuser -k 23183/tcp` before restarting dashboard

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
