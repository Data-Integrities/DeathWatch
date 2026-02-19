# ObitNOTE - Mono-repo

## Structure
- `search/` — Search engine (Node/Express, port 3000)
- `api/` — API server (Node/Express/TypeScript, port 3001)
- `client/` — Expo + React Native Web app
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

## Database
- PostgreSQL on localhost:5432, database: dw
- Migrations in api/src/db/migrations/ (006+) and search/src/db/migrations/ (001-005)
- Key tables: dw_user, user_query, user_result, exclusions

## Safe Commands
- `cd api && npm run dev` — Start API dev server
- `cd client && npx expo start --web` — Start client web
- `cd api && npm run migrate` — Run DB migrations
- `npm run lint`, `npm run typecheck`, `npm test` — In either project
