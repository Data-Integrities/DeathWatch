# ObitNOTE - Mono-repo

## Structure
- `search/` — Search engine (Node/Express, port 3000)
- `api/` — API server (Node/Express/TypeScript, port 3001)
- `client/` — Expo + React Native Web app (primary target: web browsers, mobile-responsive)
- `client-user/` — Legacy (superseded by client/)

## Quick Start
```bash
# API server
cd api && npm install && npm run migrate && npm run dev

# Client app
cd client && npm install && npx expo start --web

# Search engine (must be running for searches to work)
cd search && npm start
```

## Key Conventions
- Database columns: snake_case (name_first, score_final)
- TypeScript/JS: camelCase (nameFirst, scoreFinal)
- Category-first naming: name{Type}, score{Type}, date{Type}, url{Type}
- API endpoints: /api/auth/*, /api/searches/*, /api/matches/*, /api/notifications/*, /api/messages/*, /api/trial/*, /api/admin/*, /api/errors/*, /api/internal/*
- All match/search endpoints require JWT auth (Bearer token)

## View Names
- **Home** — `client/app/(tabs)/matches.tsx` — Unified list of all searches via SearchCard; shows match counts, status text, inline edit/delete icons; sorted: obits found → no results → confirmed
- **Searches (redirect)** — `client/app/(tabs)/searches.tsx` — Redirects to `/matches`
- **Results View** — `client/app/matches/[searchId]/index.tsx` — Obituary results for a search; "Your Search" card at top with edit icon (hidden when confirmed); MatchCard shows domain only; More Info opens domain homepage; Right/Wrong Person buttons appear only after investigating; disclaimer card at bottom; unconfirm flow with modal
- **More Info** — `client/app/matches/[searchId]/[resultId].tsx` — Simplified detail: user's search input, domain link, disclaimer (no snippet data, no deep links)
- **Welcome** — `client/app/welcome.tsx` — Post-registration choice: Try Free or Subscribe
- **Trial Search** — `client/src/components/TrialSearchModal.tsx` — Modal-based ephemeral trial search form, results with Google integration and verdict tracking
- **New Search** — `client/app/search/new.tsx` — Compact form with left-side labels (subscription required)
- **Edit Search** — `client/app/search/[id].tsx` — Edit form with Save/Delete/Cancel row
- **Settings** — `client/src/components/SettingsModal.tsx` — **This is the actual Settings UI** (modal opened by gear icon); `app/(tabs)/settings.tsx` exists but is NOT used. Always edit the modal.
- **Help** — `client/app/(tabs)/help.tsx` — Send us a message form
- **Admin Activity** — `client/app/admin/activity.tsx` — User activity report (centered grid, system font 12px, sortable columns, clickable names open user detail modal, cross-nav to Users)
- **Admin Users** — `client/app/admin/users.tsx` — All users with stats (centered grid, system font 12px, hover tooltips on abbreviated columns, impersonation, clickable names open user detail modal with tier management and trial reset, cross-nav to Activity)
- **Admin Messages** — `client/app/admin/messages.tsx` — Support messages with reply
- **Admin Error Log** — `client/app/admin/errors.tsx` — Error log with date range filters, search, sortable grid
- **Admin Support Chief** — `client/app/admin/oncall.tsx` — Support staff roster (add/edit/delete/set on-call) + fatal error log grid with date range filters, SMS status column

## UI Patterns
- TextField uses left-side labels (100px wide) instead of placeholders
- StatePicker supports `hideLabel` prop for compact layouts
- Forms target 375x667 viewport (compact padding, no helper text)
- Avoid nested Pressables on RN Web (use sibling layout instead)
- Use `adjustsFontSizeToFit` for native + CSS `clamp()` for web responsive text
- ObitNOTE brand text: purple + bold
- No browser alert/confirm dialogs — use ConfirmDialog component
- SearchCard: shows match count badges (green for new), status text, magnifying glass / green check icons, edit (32px) + trash (32px) icons with 9px gap
- MatchCard: shows domain name only (no snippet data); buttons: More Info (green outline), Right Person (solid green), Wrong Person (solid red); Right/Wrong only visible after user investigates (clicks More Info); Wrong Person acts immediately without confirmation; 150ms hover tooltip shows full domain name; confirmed results show "Confirmed as Right Person" with red "Undo" link
- AppHeader: logo (tap → home) + help icon + settings icon only (no text nav links)
- Build version: `ver YYMMDD-HHmm` stamped via `npm run stamp` in client/, baked into bundle at build time via `EXPO_PUBLIC_BUILD_VERSION`; shown on sign-in footer and settings page

## Source Compliance (Legal)
- **Never** fetch or scrape obituary source pages directly
- **Never** deep-link to specific obituary URLs — only link to source domain homepages
- **Never** display raw snippet text to users — Serper/Google data is internal-only for scoring
- `user_result.url` stores root domain only (e.g., `legacy.com`), not full URLs
- API response (MatchResult) is sanitized: id, userQueryId, sourceDomain, fingerprint, scores, isRead, status — no snippet, no image URL, no service dates
- Search engine enrichment (page fetching) is disabled globally
- Exclusion matching uses fingerprint only (no URL matching)
- New extraction fields stored internally: `dob`, `name_middle`, `pob_city`, `pob_state` (migration 018)

## Database
- PostgreSQL on localhost:5432, database: dw
- Migrations in api/src/db/migrations/ (006+) and search/src/db/migrations/ (001-005)
- Key tables: dw_user, user_query, user_result, exclusions, support_message, activity_log, login_history, trial_search, error_log, support_staff, fatal_error

## Fatal Error Alerting (Support Chief on Call)

System-wide fatal error alerting via SMS to the on-call Support Chief.

### How It Works
- `support_staff` table holds roster; exactly one person is `is_on_call = true` at a time
- `fatal_error` table logs every fatal error with source, code, message, who was on-call, and SMS delivery status
- SMS format: `ObitNote FATAL ERROR: {source} produced error {code} timestamp {YYYYMMDD HH:MM} UTC.`
- Rate limiting: max 3 SMS in 3 minutes (prevents alert storms from loops); excess errors logged with `rate_limited = true`
- SMS loop guard: if the fatal error SMS itself fails to send, it won't trigger another fatal error report

### Integration Points

| Source | Trigger | File |
|--------|---------|------|
| `serper` | Non-2xx API response | `search/src/providers/serper/SerperProvider.js` |
| `database` | PostgreSQL pool error (search) | `search/src/db/pool.js` |
| `search` | Unhandled Express error (search) | `search/src/api/server.js` |
| `database` | PostgreSQL pool error (API) | `api/src/db/pool.ts` |
| `api` | Unhandled Express error (API) | `api/src/index.ts` |
| `paddle` | Webhook signature failure | `api/src/routes/webhooks.ts` |
| `paddle` | Webhook processing error | `api/src/routes/webhooks.ts` |
| `paddle` | Paddle API non-2xx response | `api/src/services/paddleService.ts` |
| `email` | SMTP delivery failure | `api/src/services/emailService.ts` |
| `sms` | Sinch delivery failure | `api/src/services/smsService.ts` |
| `batch` | Per-query batch search failure | `api/src/services/batchService.ts` |
| `batch` | Daily cron crash | `api/src/index.ts` |
| `batch` | Batch did not run / still running / had failures | `api/src/services/backupService.ts` |
| `backup` | pg_dump or iDrive failure / missing today's backup | `api/src/services/backupService.ts` |
| `database` | DB unreachable or size over threshold | `api/src/services/backupService.ts` |
| `disk` | Web server disk usage >= 85% | `check-disk.sh` (cron on web server) |
| `email` | SMTP delivery failure | `api/src/services/emailService.ts` |
| `sms` | Sinch delivery failure | `api/src/services/smsService.ts` |
| `email` | Monthly summary cron crash | `api/src/index.ts` |

### Architecture
- API service: `api/src/services/fatalErrorService.ts` — `reportFatalError(source, errorCode, message)`
- Infrastructure monitoring: `api/src/services/backupService.ts` — backup, batch, DB health checks
- Search engine: `search/src/utils/fatalError.js` — POSTs to API internal endpoint
- Internal endpoint: `POST /api/internal/fatal-error` (localhost-only, no auth)
- Internal endpoint: `POST /api/internal/backup-report` (localhost-only, no auth)
- Admin API: `GET /api/admin/support-staff`, `POST/PATCH/DELETE`, `POST /:id/on-call`
- Admin API: `GET /api/admin/fatal-errors`, `GET /api/admin/fatal-errors/count`
- Admin UI: Settings > Support Chief (`client/app/admin/oncall.tsx`)
- Migration: `028_support_oncall.sql`

## Scheduled Jobs (node-cron in API server + system crontab)

| Schedule (UTC) | Schedule (ET) | Job | Alerts on failure |
|---------------|--------------|-----|-------------------|
| `0 16 * * *` | 11:00 AM | Daily batch search + notifications | SMS + email + `batch_log` |
| `30 16 * * *` | 11:30 AM | Batch verification (did it run? failures?) | SMS + email |
| `0 14 1 * *` | 9:00 AM 1st | Monthly summary emails | SMS + `fatal_error` |
| `0 */6 * * *` | Every 6 hrs | Database health check (reachable + size) | SMS + email |
| `10 2 * * *` | 10:10 PM | Backup verification (today's backup OK?) | SMS + email |
| `0 2 * * *` (crontab) | 10:00 PM | pg_dump + iDrive upload | SMS + email (immediate) |
| `0 */6 * * *` (crontab) | Every 6 hrs | Disk space check (>= 85%) | SMS + email |

### Monitoring Tables
- `batch_log` — daily batch run stats (migration 033): date, queries total/ok/failed, results, notifications, status
- `backup_log` — daily backup stats (migration 032): date, file path, size, pg_dump/iDrive status
- `fatal_error` — all fatal error alerts (migration 028): source, code, message, SMS delivery status

## Safe Commands
- `cd api && npm run dev` — Start API dev server
- `cd client && npx expo start --web` — Start client web
- `cd api && npm run migrate` — Run DB migrations
- `cd client && npm run stamp` — Stamp build version (writes .build-version + updates .env)
- `cd client && npm run build:web` — Production web build with stamped version
- `npm run lint`, `npm run typecheck`, `npm test` — In either project
