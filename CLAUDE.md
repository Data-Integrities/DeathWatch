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
- API endpoints: /api/auth/*, /api/searches/*, /api/matches/*, /api/notifications/*
- All match/search endpoints require JWT auth (Bearer token)

## View Names
- **Home / Match View** — `client/app/(tabs)/matches.tsx` — Dashboard with intro card, New Search button, Matches section, Searches section
- **Searches View** — `client/app/(tabs)/searches.tsx` — All searches listed alphabetically
- **Results View** — `client/app/matches/[searchId]/index.tsx` — Match results for a specific search
- **Obit View** — `client/app/matches/[searchId]/[resultId].tsx` — Single obituary detail with confirm/reject actions
- **New Search** — `client/app/search/new.tsx` — Compact form with left-side labels
- **Edit Search** — `client/app/search/[id].tsx` — Edit form with Save/Delete/Cancel row

## UI Patterns
- TextField uses left-side labels (100px wide) instead of placeholders
- StatePicker supports `hideLabel` prop for compact layouts
- Forms target 375x667 viewport (compact padding, no helper text)
- Avoid nested Pressables on RN Web (use sibling layout instead)
- Use `adjustsFontSizeToFit` for native + CSS `clamp()` for web responsive text
- ObitNOTE brand text: purple + bold
- No browser alert/confirm dialogs — use ConfirmDialog component

## Database
- PostgreSQL on localhost:5432, database: dw
- Migrations in api/src/db/migrations/ (006+) and search/src/db/migrations/ (001-005)
- Key tables: dw_user, user_query, user_result, exclusions

## Safe Commands
- `cd api && npm run dev` — Start API dev server
- `cd client && npx expo start --web` — Start client web
- `cd api && npm run migrate` — Run DB migrations
- `npm run lint`, `npm run typecheck`, `npm test` — In either project
