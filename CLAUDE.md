# DeathWatch Obituary Search Engine

## Overview
Node.js obituary search engine that searches Google for obituaries based on user-provided criteria.

## Project Structure
```
DeathWatch/
├── src/
│   ├── index.js              # Main search orchestrator
│   ├── config.js             # Settings & provider config
│   ├── cli/search.js         # CLI interface (commander.js)
│   ├── api/server.js         # Express HTTP API (port 3000)
│   ├── utils/                # logger, cache
│   ├── normalize/            # name, nicknames, location, age, dod, serviceDates, enrichPage
│   ├── data/
│   │   └── ExclusionStore.js # Per-query & global exclusions (PostgreSQL)
│   ├── db/
│   │   ├── pool.js           # pg.Pool singleton
│   │   ├── migrate.js        # Database migration runner
│   │   ├── import-legacy.js  # Import exclusions.json into DB
│   │   ├── BatchStore.js     # Batch/query/results CRUD
│   │   └── migrations/
│   │       └── 001_initial_schema.sql
│   ├── providers/
│   │   ├── google/           # GoogleProvider (requires CSE setup)
│   │   ├── serper/           # SerperProvider (recommended)
│   │   └── serpapi/          # SerpApiProvider
│   ├── scoring/
│   │   ├── criteriaScore.js  # 0-100 scoring per criteria
│   │   ├── levenshtein.js    # Fuzzy string matching
│   │   ├── score.js          # Legacy scoring
│   │   └── explain.js        # Result formatting
│   ├── dedupe/               # fingerprint, dedupe
│   └── __tests__/            # Jest tests (64 tests)
├── clients/
│   └── obit-client1/         # Web UI for reviewing results
│       ├── server.js         # Express server (port 3001)
│       └── public/index.html # Single-page UI
├── data/
│   ├── search-input.json     # User-supplied search input
│   ├── exclusions.json       # Legacy exclusions (imported to DB)
│   └── cache/                # Stub data for offline testing
└── package.json
```

## Input/Output Files

### Input File Format (`search-input.json`)
User-supplied list of people to search for:
```json
[
  {
    "firstName": "James",
    "middleName": "William",
    "lastName": "Smith",
    "apxAge": 71,
    "city": "Hamilton",
    "state": "OH"
  }
]
```

Required fields: `firstName`, `lastName`
Optional fields: `middleName`, `apxAge`, `city`, `state`

### Output
Batch results are stored in PostgreSQL. Each batch search prints a batch ID on completion. Results can be viewed via the web UI or queried via the API.

## Commands

### CLI - Batch Search (Primary Use)
```bash
# Search for all people in input file (results stored in PostgreSQL)
node src/cli/search.js batch --file data/search-input.json

# With verbose logging
node src/cli/search.js batch --file data/search-input.json -v
```

### CLI - Single Search
```bash
node src/cli/search.js search --first James --last Smith --city Hamilton --state OH --age 71
```

### CLI - Exclusions
```bash
# Exclude false positive (per-query)
node src/cli/search.js exclude --first James --last Smith --state OH --fingerprint "smith-j-cincinnati-oh-unknown"

# Exclude globally (applies to all searches)
node src/cli/search.js exclude --global --url "https://example.com/page" --reason "generic page"

# List exclusions for a query
node src/cli/search.js exclusions --first James --last Smith --state OH

# List all exclusions
node src/cli/search.js exclusions --all

# Show exclusion statistics
node src/cli/search.js exclusion-stats

# Remove exclusion
node src/cli/search.js unexclude --id <uuid>
```

### CLI - Interactive Review
```bash
# Review results from a batch in the database
node src/cli/search.js review --batch <batch-id>

# Review results from a legacy JSON file
node src/cli/search.js review --file data/results-20260204-031939.json
# Commands: [y]es/correct, [n]o/exclude, [g]lobal exclude, [s]kip, [q]uit
```

### Web UI - obit-client1
```bash
cd clients/obit-client1 && npm install
node server.js                    # Serves latest batch from DB
node server.js --batch <batch-id> # Serves specific batch
# Open http://localhost:3001
```

### API Server
```bash
npm start  # Runs on http://localhost:3000
```

**Endpoints:**
- `GET /search?firstName=&lastName=&city=&state=&age=`
- `POST /exclude` - body: `{ searchKey, fingerprint, url?, name?, reason? }`
- `GET /exclusions?searchKey=`
- `DELETE /exclude/:id`
- `GET /batches` - list all batches
- `GET /batches/latest` - get latest batch with results
- `GET /batches/:id` - get batch by ID with results
- `GET /health`

### Tests
```bash
npm test
```

## Scoring System

Each result is scored on 5 criteria (0-100 each). `finalScore` = sum of all applicable criteria.
Results are ranked by finalScore (rank 1 = best guess).

| Criteria | Score Range | Notes |
|----------|-------------|-------|
| Last Name | 0-100 | Levenshtein similarity (e.g., Fagen→Fagan = 80) |
| First Name | 0-100 | Levenshtein + nickname matching (Jim→James = 90) |
| State | 0 or 100 | Exact match only |
| City | 0, 50, or 100 | 100=exact, 50=different city same state, 0=mismatch |
| Age | 0-100 | ±0.5yr=100, ±1yr=90, ... ±6yr=40, >6yr=0 |

**Age Adjustment:** If `inputDate` is provided per-person, query age is adjusted based on elapsed time since that date.

**Example:** Score 480/500 means 4 criteria matched well, 1 partial match.

## Fingerprint Format
`lastname-firstinitial-city-state-dod`
Example: `smith-j-hamilton-oh-2024-01-15`

## Search Provider Setup

Configure in `.env` file:

```bash
# Choose provider: serper, serpapi, or google
SEARCH_PROVIDER=serper
```

### Serper.dev (Recommended)
- 2,500 free searches, then $50/50,000
- https://serper.dev
```bash
SERPER_API_KEY=your_key
```

### SerpAPI
- 100 free/month, then $50/5,000
- https://serpapi.com
```bash
SERPAPI_KEY=your_key
```

### Google CSE
- Requires billing setup (complex)
- https://console.cloud.google.com
```bash
GOOGLE_CSE_API_KEY=your_key
GOOGLE_CSE_ID=your_cse_id
```

Without any API keys configured, the engine uses stub data from `data/cache/google-sample.json`.

## Page Enrichment

After scoring, the engine fetches actual obituary web pages for the top results to extract data not available in truncated search snippets (especially funeral/visitation dates).

- Enabled by default; disable with `ENRICH_PAGES=false` in `.env`
- Fetches only the best guess (rank 1) per query, 8s timeout per page
- Extracts: funeral date, visitation date, DOD (if missing from snippet)
- Year inference: when a service date has no year, it's inferred from DOD (same year, but next year if the date falls before DOD at year-end cusp)
- Gracefully handles 403s, timeouts, PDFs, and non-HTML content

**Extraction rates (10-query sample):**
| Field | Snippet Only | With Enrichment |
|-------|-------------|-----------------|
| DOD   | 42%         | 54%             |
| Funeral date | 1%   | 13%             |
| Visitation   | 0%   | 7%              |

## Database Setup

### Credentials
- **User**: dwadmin
- **Password**: dwdata
- **Database**: dw
- **Host**: localhost:5432

### Prerequisites
1. Install PostgreSQL locally
2. Create the database and user:
   ```sql
   CREATE DATABASE dw;
   CREATE USER dwadmin WITH PASSWORD 'dwdata';
   ALTER USER dwadmin WITH SUPERUSER;
   ```
3. `.env` is committed to the repo with all credentials

### Migration
```bash
npm run db:migrate
node src/db/load-name-variants.js
```

### Import Legacy Data
To import existing `data/exclusions.json` into PostgreSQL:
```bash
node src/db/import-legacy.js
```

### Tables
- `exclusions` - Per-query and global exclusions
- `batches` - Batch search runs
- `queries` - Individual search queries within a batch
- `results` - Search results for each query
- `user_query` - User-managed search queries
- `user_result` - Results from user queries
- `name_first_variant` - First name nickname/variant mappings (2,691 entries)

## Dependencies
- express - HTTP server
- commander - CLI parsing
- pg - PostgreSQL client
- uuid - ID generation
- dotenv - Environment configuration
- jest - Testing
