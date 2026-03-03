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
- API endpoints: /api/auth/*, /api/searches/*, /api/matches/*, /api/notifications/*, /api/messages/*, /api/admin/*
- All match/search endpoints require JWT auth (Bearer token)

## View Names
- **Home** — `client/app/(tabs)/matches.tsx` — Unified list of all searches via SearchCard; shows match counts, status text, inline edit/delete icons; sorted: obits found → no results → confirmed
- **Searches (redirect)** — `client/app/(tabs)/searches.tsx` — Redirects to `/matches`
- **Results View** — `client/app/matches/[searchId]/index.tsx` — Obituary results for a search; auto-skips to detail if exactly 1 active result; inline Right/Wrong Person buttons on MatchCard
- **Obit View** — `client/app/matches/[searchId]/[resultId].tsx` — Single obituary detail with confirm/reject actions
- **New Search** — `client/app/search/new.tsx` — Compact form with left-side labels
- **Edit Search** — `client/app/search/[id].tsx` — Edit form with Save/Delete/Cancel row
- **Help** — `client/app/(tabs)/help.tsx` — Send us a message form
- **Admin Activity** — `client/app/admin/activity.tsx` — User activity report (800px grid, system font 14px, sortable columns)
- **Admin Users** — `client/app/admin/users.tsx` — All users with stats (800px grid, system font 14px, hover tooltips on abbreviated columns)
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
- MatchCard: inline More Info / Right Person / Wrong Person buttons; More Info = green outline white bg, Right = solid green, Wrong = solid red; "Died:" label (not "DOD:")
- AppHeader: logo (tap → home) + help icon + settings icon only (no text nav links)
- Build version: `ver YYMMDD-HHmm` from `client/src/version.ts`, shown on sign-in footer and settings page

## Database
- PostgreSQL on localhost:5432, database: dw
- Migrations in api/src/db/migrations/ (006+) and search/src/db/migrations/ (001-005)
- Key tables: dw_user, user_query, user_result, exclusions, support_message, activity_log, login_history

## Safe Commands
- `cd api && npm run dev` — Start API dev server
- `cd client && npx expo start --web` — Start client web
- `cd api && npm run migrate` — Run DB migrations
- `npm run lint`, `npm run typecheck`, `npm test` — In either project
