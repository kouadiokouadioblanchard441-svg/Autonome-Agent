- [DB schema exports](db-schema-exports.md) — run typecheck:libs after adding new schema files; stale declarations cause false "no exported member" errors in api-server
  - [Campaign date handling](campaign-dates.md) — Zod parses startDate/endDate/expiresAt as strings; must convert new Date() before Drizzle insert/update
  - [Dashboard port 23183](dashboard-port.md) — if workflow fails DIDNT_OPEN_A_PORT, kill previous Vite with fuser -k 23183/tcp then restart
  - [Telethon Python backend](python-backend.md) — separate FastAPI service in /python-backend; requires TELEGRAM_API_ID, TELEGRAM_API_HASH, DATABASE_URL
  