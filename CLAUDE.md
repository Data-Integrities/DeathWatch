# DeathWatch Obituary Search Engine

## Overview
Node.js obituary search engine that searches Google for obituaries based on user-provided criteria.

## Project Structure
```
obit-engine/
├── src/
│   ├── index.js              # Main search orchestrator
│   ├── config.js             # Settings & scoring weights
│   ├── cli/search.js         # CLI interface (commander.js)
│   ├── api/server.js         # Express HTTP API (port 3000)
│   ├── utils/                # logger, cache
│   ├── normalize/            # name, nicknames, location, age
│   ├── data/                 # ExclusionStore
│   ├── providers/
│   │   ├── google/           # GoogleProvider (requires CSE setup)
│   │   ├── serper/           # SerperProvider (recommended)
│   │   └── serpapi/          # SerpApiProvider
│   ├── scoring/              # score, explain
│   ├── dedupe/               # fingerprint, dedupe
│   └── __tests__/            # Jest tests
├── data/
│   ├── search-input.json     # User-supplied search input
│   ├── exclusions.json       # False positive exclusions
│   └── cache/google-sample.json  # Stub Google SERP data
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

### Output File Format
Results are written to `data/results-YYYYMMDD-HHMMSS.json`:
```json
[
  {
    "query": { "firstName": "James", "lastName": "Smith", ... },
    "searchKey": "3dbf81fdb5b93fe5",
    "resultCount": 5,
    "results": [ ... ]
  }
]
```

## Commands

### CLI - Batch Search (Primary Use)
```bash
# Search for all people in input file
node src/cli/search.js batch --file data/search-input.json

# With custom output directory
node src/cli/search.js batch --file data/search-input.json --output-dir results/

# With verbose logging
node src/cli/search.js batch --file data/search-input.json -v
```

### CLI - Single Search
```bash
node src/cli/search.js search --first James --last Smith --city Hamilton --state OH --age 71
```

### CLI - Exclusions
```bash
# Exclude false positive
node src/cli/search.js exclude --first James --last Smith --state OH --fingerprint "smith-j-cincinnati-oh-unknown"

# List exclusions
node src/cli/search.js exclusions --first James --last Smith --state OH

# Remove exclusion
node src/cli/search.js unexclude --id <uuid>
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
- `GET /health`

### Tests
```bash
npm test
```

## Scoring Weights
| Signal | Points |
|--------|--------|
| Last name exact | +35 |
| Last name mismatch | -35 |
| City exact | +20 |
| State exact | +15 |
| Age in range (±6 years) | +15 |
| First name exact | +10 |
| First name mismatch | -10 |
| Nickname match | +6 |
| Middle initial | +3 |
| City mismatch same state | -10 |
| Age outside range | -15 |

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

## Dependencies
- express - HTTP server
- commander - CLI parsing
- uuid - ID generation
- dotenv - Environment configuration
- jest - Testing
