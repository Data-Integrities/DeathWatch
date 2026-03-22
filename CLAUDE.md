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
- API endpoints: /api/auth/*, /api/searches/*, /api/matches/*, /api/notifications/*, /api/messages/*, /api/trial/*, /api/admin/*
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
- **Help** — `client/app/(tabs)/help.tsx` — Send us a message form
- **Admin Activity** — `client/app/admin/activity.tsx` — User activity report (centered grid, system font 12px, sortable columns, clickable names open user detail modal, cross-nav to Users)
- **Admin Users** — `client/app/admin/users.tsx` — All users with stats (centered grid, system font 12px, hover tooltips on abbreviated columns, impersonation, clickable names open user detail modal with tier management and trial reset, cross-nav to Activity)
- **Admin Messages** — `client/app/admin/messages.tsx` — Support messages with reply

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
- Build version: `ver YYMMDD-HHmm` from `client/src/version.ts`, shown on sign-in footer and settings page

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
- Key tables: dw_user, user_query, user_result, exclusions, support_message, activity_log, login_history, trial_search

## Safe Commands
- `cd api && npm run dev` — Start API dev server
- `cd client && npx expo start --web` — Start client web
- `cd api && npm run migrate` — Run DB migrations
- `npm run lint`, `npm run typecheck`, `npm test` — In either project
