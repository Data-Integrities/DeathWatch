# ObitNote — Master Technical Documentation

**Last Modified:** 2026-05-19  
**Owner:** James Jones (james.jones@obitnote.com)  
**Audience:** Successor developer / operations handoff

---

## Table of Contents

1. [Business Overview](#1-business-overview)
2. [System Architecture](#2-system-architecture)
3. [Code Modules](#3-code-modules)
4. [Database](#4-database)
5. [Infrastructure & Servers](#5-infrastructure--servers)
6. [Deployment](#6-deployment)
7. [Scheduled Jobs & Automation](#7-scheduled-jobs--automation)
8. [Monitoring & Alerting](#8-monitoring--alerting)
9. [Backup & Disaster Recovery](#9-backup--disaster-recovery)
10. [Third-Party Services & Credentials](#10-third-party-services--credentials)
11. [Security](#11-security)
12. [Admin Capabilities](#12-admin-capabilities)
13. [Billing & Subscription Management](#13-billing--subscription-management)
14. [Runbooks](#14-runbooks)
15. [Development Environment](#15-development-environment)
16. [Legal & Compliance](#16-legal--compliance)

---

## 1. Business Overview

### What ObitNote Does

ObitNote is an obituary monitoring and alert service.  Customers register people they want to monitor (elderly relatives, estranged family members, old friends).  Every day, ObitNote searches the internet for obituaries matching those people and notifies the customer by email and/or SMS when a potential match is found.

### Target Market

- **Consumer (Basic):** Track 1-5 people — elderly parents, extended family
- **Consumer (Plus):** Track 6+ people — large families, communities, old friends
- **Commercial (Pro):** Clergy, attorneys, real estate agents, corporate HR — paid add-ons for bulk management

### Revenue Model

Annual subscriptions via Paddle.com (merchant of record).  Basic $20/year (up to 5 people), Plus $4/person/year beyond 5.  Pro adds optional grid editing ($150/yr) and staff-assisted import ($150 each).

### User Journey

1. User visits obitnote.com, registers account
2. Tries 2-3 free trial searches on known deceased persons (demo)
3. Subscribes (Paddle checkout)
4. Adds people to monitor (living persons)
5. Daily batch searches Google via Serper.dev API
6. Results scored and deduplicated; matches stored
7. Email + SMS notifications for new matches
8. User reviews matches: "Right Person" (confirmed, monitoring stops) or "Wrong Person" (dismissed)

### Business Entity

UltraSafe Data, LLC (US)  
Contact: support@obitnote.com  
Domain: obitnote.com (also owns obitnotes.com, redirects to obitnote.com)

---

## 2. System Architecture

### High-Level Topology

```
                      INTERNET
                         |
                         v
                +------------------+
                | Cloudflare DNS   |
                |   obitnote.com   |
                +--------+---------+
                         |
                         v
    +----------------------------------------------+
    |  PRODUCTION WEB SERVER                       |
    |  ON-WB-CHI-1 (103.90.163.56)                 |
    |  Private: 10.0.0.4                           |
    |                                              |
    |  +----------+  +----------+  +----------+    |
    |  |  nginx   |  |   PM2    |  |   cron   |    |
    |  | :80/:443 |  |          |  |   jobs   |    |
    |  +----+-----+  +----+-----+  +----------+    |
    |       |              |                       |
    |       v              v                       |
    |  /client/dist   +--------+    +--------+     |
    |  (static SPA)   |  api   |    | search |     |
    |                 | :3001  |    | :3000  |     |
    |                 +---+----+    +---+----+     |
    +------|--------------|-------------|----------+
           |              |             |
           |     Private VLAN (10.0.0.0/23)
           |              |             |
    +------|--------------|-------------|----------+
    |      v              v             v          |
    |  PRODUCTION DB SERVER                        |
    |  ON-DB-CHI-1 (10.0.0.2)                      |
    |  NO public IP                                |
    |                                              |
    |  PostgreSQL 16 (:5432)                       |
    |  Database: dw                                |
    +----------------------------------------------+

    +----------------------------------------------+
    |  STAGING SERVER                              |
    |  ON-ST-CHI-1 (146.71.78.194)                 |
    |  Private: 10.0.0.5                           |
    |  All-in-one: nginx + API + Search + PG       |
    |  Port 22: VLAN only (public SSH closed)      |
    +----------------------------------------------+

    +----------------------------------------------+
    |  DEV/BUILD SERVER                            |
    |  GE-DV-CHI-3 (146.71.78.117)                 |
    |  Private: 10.0.0.3                           |
    |  SSH key access to all servers               |
    +----------------------------------------------+
```

### Request Flow

```
Browser  --(HTTPS)--> nginx (SSL termination)
  |
  +-- Static files (/*, /_expo/*, /assets/*) --> client/dist/
  |
  +-- API calls (/api/*) --> reverse proxy --> localhost:3001 (API server)
          |
          +-- Search requests --> localhost:3000 (Search engine)
          |
          +-- All DB queries --> 10.0.0.2:5432 (PostgreSQL)
```

### Service Communication

```
+-------------+          +-------------+         +---------------+
|   Client    |  --API-->|     API     | --HTTP->| Search Engine |
|  (Browser)  |          |  (Express)  |         |   (Express)   |
+-------------+          +------+------+         +-------+-------+
                                |                        |
                                v                        v
                         +------+------+         +-------+-------+
                         | PostgreSQL  |         | Serper.dev    |
                         | (10.0.0.2)  |         | (Google API)  |
                         +-------------+         +---------------+
```

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Client | Expo + React Native Web | Expo 52, React 18.3, RN 0.76 |
| API Server | Node.js + Express + TypeScript | Node 20, Express 4 |
| Search Engine | Node.js + Express (JavaScript) | Node 20, Express 4 |
| Database | PostgreSQL | 16 (prod), 18 (dev) |
| Process Manager | PM2 | 7.0.1 |
| Web Server | nginx | 1.28.3 |
| SSL | Let's Encrypt (certbot) | Auto-renewal |
| OS | Ubuntu | 26.04 LTS (web), 24.04 LTS (db, staging) |
| Hosting | Kamatera | Chicago datacenter |

---

## 3. Code Modules

### Repository Structure

```
obit-person/                          # Mono-repo root
├── api/                              # API server (TypeScript)
│   ├── src/
│   │   ├── index.ts                  # Express app, routes, cron jobs
│   │   ├── routes/
│   │   │   ├── auth.ts               # Register, login, password reset, verify email
│   │   │   ├── searches.ts           # CRUD for user search queries
│   │   │   ├── matches.ts            # Result review (confirm/reject)
│   │   │   ├── notifications.ts      # Notification preferences
│   │   │   ├── messages.ts           # Support messaging
│   │   │   ├── trial.ts              # Free trial search endpoints
│   │   │   ├── subscription.ts       # Cancel, change plan
│   │   │   ├── webhooks.ts           # Paddle payment webhooks
│   │   │   ├── admin.ts              # Admin: users, activity, impersonation
│   │   │   └── errors.ts             # Client error reporting
│   │   ├── services/
│   │   │   ├── authService.ts        # JWT, bcrypt, user CRUD, preferences
│   │   │   ├── searchService.ts      # Search query management
│   │   │   ├── matchService.ts       # Result management, purging
│   │   │   ├── batchService.ts       # Daily batch orchestration
│   │   │   ├── emailService.ts       # Nodemailer templates (Zoho SMTP)
│   │   │   ├── smsService.ts         # Sinch SMS sending
│   │   │   ├── paddleService.ts      # Paddle API (subscriptions)
│   │   │   ├── fatalErrorService.ts  # SMS/DB alerting for fatal errors
│   │   │   ├── backupService.ts      # Backup/batch/DB health monitoring
│   │   │   ├── messageService.ts     # Support ticket management
│   │   │   ├── activityService.ts    # Activity logging
│   │   │   ├── geoService.ts         # MaxMind GeoIP lookups
│   │   │   └── browserFetch.ts       # Puppeteer/Chromium page fetcher
│   │   ├── db/
│   │   │   ├── pool.ts              # pg.Pool (reports fatal on pool error)
│   │   │   ├── migrate.ts           # Migration runner (_migrations table)
│   │   │   └── migrations/          # 006-033 SQL migration files
│   │   └── types.ts                 # Shared TypeScript interfaces
│   ├── dist/                        # Compiled JS (production runs from here)
│   ├── package.json
│   └── tsconfig.json
│
├── search/                           # Search engine (JavaScript)
│   ├── src/
│   │   ├── index.js                  # Main orchestrator (searchObits)
│   │   ├── config.js                 # Provider selection, thresholds
│   │   ├── api/server.js             # Express HTTP API (:3000)
│   │   ├── providers/
│   │   │   ├── serper/               # Serper.dev provider (primary)
│   │   │   ├── serpapi/              # SerpAPI provider (backup)
│   │   │   └── google/              # Google CSE provider
│   │   ├── normalize/
│   │   │   ├── name.js              # Name parsing/comparison
│   │   │   ├── nameExtract.js       # Extract names from search titles
│   │   │   ├── nicknames.js         # Nickname/variant matching
│   │   │   ├── location.js          # City/state extraction
│   │   │   ├── age.js               # Age calculation from DOB/DOD
│   │   │   ├── dod.js               # Date of death parsing
│   │   │   ├── dob.js               # Date of birth parsing
│   │   │   └── serviceDates.js      # Funeral/visitation date parsing
│   │   ├── scoring/
│   │   │   ├── criteriaScore.js     # 6-criteria scoring (0-100 each)
│   │   │   └── levenshtein.js       # Fuzzy string matching
│   │   ├── dedupe/
│   │   │   ├── fingerprint.js       # Result fingerprinting
│   │   │   └── dedupe.js            # Deduplication logic
│   │   ├── data/ExclusionStore.js   # Per-query exclusion management
│   │   ├── db/
│   │   │   ├── pool.js              # pg.Pool (reports fatal on pool error)
│   │   │   ├── migrate.js           # Migration runner
│   │   │   └── migrations/          # 001-005 SQL migration files
│   │   └── utils/
│   │       ├── fatalError.js        # POSTs to API /api/internal/fatal-error
│   │       └── logger.js            # Console logger with levels
│   ├── search_test_data/            # Ground-truth test framework
│   └── package.json
│
├── client/                           # Expo + React Native Web app
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── sign-in.tsx          # Sign-in (adaptive: intro vs. clean)
│   │   │   └── register.tsx         # Registration with ToS consent
│   │   ├── (tabs)/
│   │   │   ├── matches.tsx          # Home screen (unified search list)
│   │   │   ├── help.tsx             # Support messaging
│   │   │   └── settings.tsx         # Unused placeholder (see SettingsModal)
│   │   ├── admin/
│   │   │   ├── activity.tsx         # User activity report
│   │   │   ├── users.tsx            # User management + impersonation
│   │   │   ├── messages.tsx         # Support ticket admin
│   │   │   ├── errors.tsx           # Error log viewer
│   │   │   └── oncall.tsx           # Support Chief roster + fatal errors
│   │   ├── search/
│   │   │   ├── new.tsx              # New search form
│   │   │   └── [id].tsx             # Edit search form
│   │   ├── matches/
│   │   │   └── [searchId]/
│   │   │       ├── index.tsx        # Results list for a search
│   │   │       └── [resultId].tsx   # Single result detail
│   │   ├── welcome.tsx              # Post-registration (Try Free / Subscribe)
│   │   ├── terms.tsx                # Terms of Service
│   │   ├── privacy.tsx              # Privacy Policy
│   │   ├── refund.tsx               # Refund Policy
│   │   └── pricing.tsx              # Pricing page
│   ├── src/
│   │   ├── components/
│   │   │   ├── SettingsModal.tsx     # THE actual settings UI (modal)
│   │   │   ├── TrialSearchModal.tsx  # Free trial search experience
│   │   │   ├── SearchCard.tsx        # Home screen card per search
│   │   │   ├── MatchCard.tsx         # Result card (domain, actions)
│   │   │   ├── ConfirmDialog.tsx     # Custom confirmation dialog
│   │   │   ├── TextField.tsx         # Left-label text input
│   │   │   ├── StatePicker.tsx       # US state dropdown
│   │   │   ├── AppHeader.tsx         # Logo + help + settings icons
│   │   │   └── Toast.tsx             # Transient success messages
│   │   ├── context/
│   │   │   └── AuthContext.tsx       # JWT auth, user state, 60s auto-refresh
│   │   ├── api/
│   │   │   └── client.ts            # Axios-based API client
│   │   └── theme.ts                 # Colors, spacing, typography
│   ├── scripts/
│   │   ├── stamp.js                 # Build version stamper
│   │   └── build-web.js             # Production build orchestrator
│   └── package.json
│
├── client-user/                      # Legacy (superseded by client/)
├── CLAUDE.md                         # Developer conventions reference
├── ObitNote.md                       # This file
└── package.json                      # Root: `npm run dev` starts all services
```

### API Server (api/)

**Purpose:** Authentication, authorization, data management, scheduled jobs, payment processing, notifications.

**Key Services:**

| Service | Responsibility |
|---------|---------------|
| authService | User registration, login (bcrypt+JWT), email verification, password reset, preferences |
| searchService | CRUD for monitored person searches, 16-second throttle, plan limit enforcement |
| matchService | Result status management (confirm, reject, dismiss), purge old rejected results |
| batchService | Daily batch orchestration: query Serper for all active searches, deduplicate, store new results |
| emailService | All transactional email via Zoho SMTP (notifications, verification, monthly summary, alerts) |
| smsService | SMS via Sinch SDK (match notifications, fatal error alerts) |
| paddleService | Paddle API: create/update/cancel subscriptions, sync person quantities |
| fatalErrorService | Log fatal errors to DB, SMS on-call Support Chief (rate-limited 3/3min) |
| backupService | Infrastructure monitoring: backup verification, batch verification, DB health checks |
| geoService | MaxMind GeoLite2 IP-to-location (login history) |
| browserFetch | Headless Chromium for Cloudflare-protected pages (proxy endpoint) |

**Internal Endpoints (localhost-only, no auth):**
- `POST /api/internal/fatal-error` — fatal error reporting from search engine/cron scripts
- `POST /api/internal/backup-report` — backup status from backup-db.sh shell script

### Search Engine (search/)

**Purpose:** Accept a person's details, query Google (via Serper.dev), parse/normalize results, score against input criteria, deduplicate, filter exclusions, return ranked matches.

**Scoring System (6 criteria, 0-100 each, max 600):**

| Criteria | Method |
|----------|--------|
| Last Name | Levenshtein similarity (Fagen→Fagan = 80) |
| First Name | Levenshtein + nickname database (Jim→James = 90) |
| State | Exact match (0 or 100) |
| City | Exact=100, same-state-different-city=50, mismatch=0 |
| Age | ±0.5yr=100, scales down to 0 at ±6yr |
| Keywords | Any keyword substring found in snippet = 100 |

**Fingerprint Format:** `lastname-firstinitial-city-state-dod`  
Used for deduplication and exclusion matching across syndicated obituary URLs.

**Page Enrichment:** DISABLED in production (source compliance).  When enabled, fetches rank-1 result to extract funeral/visitation dates.

### Client App (client/)

**Purpose:** Mobile-responsive web app (primary target: browsers on phones/tablets/desktops).  Built with Expo + React Native Web for potential future native iOS/Android builds.

**Key Patterns:**
- JWT auth with 60-second background refresh (catches admin changes without re-login)
- Left-side label form fields (100px width)
- No browser alert/confirm — always ConfirmDialog component
- Purple (#663399) brand color, #444444 text, green (#2E7D32) action buttons
- Build version stamped at build time via EXPO_PUBLIC_BUILD_VERSION

---

## 4. Database

### Connection Details

| Environment | Host | Port | Database | User | Password Location |
|-------------|------|------|----------|------|-------------------|
| Production | 10.0.0.2 | 5432 | dw | onadmin | api/.env on web server |
| Staging | localhost | 5432 | dw | onadmin | api/.env on staging |
| Development | localhost | 5432 | dw | dwadmin | api/.env in repo |

### Core Tables

| Table | Purpose |
|-------|---------|
| dw_user | User accounts (email, password hash, subscription, preferences) |
| user_query | Monitored person searches (one row per person being watched) |
| user_result | Search results/matches (linked to user_query) |
| exclusions | Rejected results (fingerprint-based, prevents re-surfacing) |
| trial_search | Ephemeral free trial results (not in daily batch) |
| login_history | Login events with IP, geolocation, user agent |
| activity_log | User action log (searches, matches, settings changes) |
| support_message | In-app support tickets (user ↔ admin) |
| support_staff | On-call roster for fatal error SMS |
| fatal_error | All fatal error events and SMS delivery status |
| batch_log | Daily batch run statistics |
| backup_log | Daily backup verification records |
| error_log | Client-side JavaScript errors |
| redirect_log | obitnotes.com → obitnote.com redirect tracking |
| name_first_variant | Nickname/variant mappings (2,691 entries) for scoring |
| _migrations | Migration tracking (prevents re-running applied migrations) |

### Migration System

- **Search engine migrations:** `search/src/db/migrations/` (001-005)
- **API migrations:** `api/src/db/migrations/` (006-033)
- Both use `_migrations` tracking table — idempotent, safe to run repeatedly
- Run: `cd api && npm run migrate` and `cd search && npm run db:migrate`

### Key Relationships

```
dw_user (login_id PK)
  |
  +-- user_query (login_id FK) --- one user has many searches
  |     |
  |     +-- user_result (user_query_id FK) --- one search has many results
  |     |
  |     +-- exclusions (key_search FK) --- rejected results per search
  |
  +-- login_history (login_id FK)
  +-- activity_log (login_id FK)
  +-- support_message (login_id FK)
  +-- trial_search (login_id FK)
  +-- error_log (login_id FK)
```

---

## 5. Infrastructure & Servers

### Hostname Naming Schema

Format: **ON-{FUNCTION}-{LOCATION}-{INSTANCE}** (all caps)

| Segment | Meaning | Values |
|---------|---------|--------|
| Product | Product/purpose | `ON` = ObitNote, `GE` = general |
| Function | Server role | `DB` = database, `WB` = web, `ST` = staging, `DV` = development |
| Location | Datacenter city (3 letters) | `CHI` = Chicago, `DAL` = Dallas, `TOR` = Toronto |
| Instance | Numeric instance | `1`, `2`, etc. |

### Production Environment

| Server | Hostname | Public IP | Private/VPN IP | Role |
|--------|----------|-----------|----------------|------|
| Web Server | ON-WB-CHI-1 | 103.90.163.56 | 10.0.0.4 / 10.10.0.1 | nginx, API, Search, crons |
| DB Server | ON-DB-CHI-1 | None (removed) | 10.0.0.2 | PostgreSQL 16 primary |
| Dev/Build | GE-DV-CHI-3 | 146.71.78.117 | 10.0.0.3 | Development, deploy source |
| Warm Standby | ON-PB-DAL-1 | 43.231.235.200 | 10.10.0.2 | PG replica, API, Search (standby) |

**Hosting Provider:** Kamatera (Chicago + Dallas datacenters)  
**VLAN:** `lan-1834538-obitnote-chi` (10.0.0.0/23, no gateway)  
**VPN:** WireGuard tunnel (10.10.0.0/24) between Chicago web and Dallas standby

### Staging Environment

| Server | Hostname | Public IP | Private IP | Role |
|--------|----------|-----------|------------|------|
| Staging (all-in-one) | ON-ST-CHI-1 | 146.71.78.194 | 10.0.0.5 | nginx + API + Search + PostgreSQL |

**Domain:** stage.obitnote.com  
**SSH:** `obitnote_admin@146.71.78.194` (root login disabled)

### Network Security

```
INTERNET                                   INTERNET
    |                                          |
    v (ports 80, 443 only)                     v (port 51820 WireGuard)
+-----------------------------+          +-----------------------------+
| Web Server (10.0.0.4)       |          | Standby (10.10.0.2)         |
| Chicago, ON-WB-CHI-1        |          | Dallas, ON-PB-DAL-1         |
| UFW: 22, 80, 443, 51820     |          | UFW: 22, 80, 443, 51820     |
| WireGuard: 10.10.0.1        |          | WireGuard: 10.10.0.2        |
| IP forwarding + MASQUERADE  |          | SERVER_ROLE=standby         |
| Crons, notifications        |          | PG streaming replica        |
+-----------------------------+          +-----------------------------+
    |               |                               |
    |               |    WireGuard VPN tunnel       |
    |               |    (10.10.0.0/24, ~24ms)      |
    |               +-------------------------------+
    |
    | Private VLAN (10.0.0.0/23)
    | TCP only (ICMP blocked by Kamatera)
    |
+-----------------------------+
| DB Server (10.0.0.2)        |
| Chicago, ON-DB-CHI-1        |
| pg_hba: 10.0.0.4, 10.0.0.5  |
| replicator: 10.0.0.4        |
| NO public IP                |
| NO UFW ports open           |
+-----------------------------+

+-----------------------------+
| Staging (10.0.0.5)          |
| Chicago, ON-ST-CHI-1        |
| UFW: 80, 443                |
| Port 22: VLAN only          |
+-----------------------------+
```

### WireGuard VPN (Chicago ↔ Dallas)

The Dallas standby server (ON-PB-DAL-1) connects to the Chicago web server (ON-WB-CHI-1) via a WireGuard VPN tunnel.  Chicago forwards Dallas traffic to the VLAN using IP forwarding and MASQUERADE NAT.

| Setting | Chicago (ON-WB-CHI-1) | Dallas (ON-PB-DAL-1) |
|---------|----------------------|----------------------|
| VPN IP | 10.10.0.1/24 | 10.10.0.2/24 |
| Listen port | 51820 | Dynamic |
| Config file | /etc/wireguard/wg0.conf | /etc/wireguard/wg0.conf |
| AllowedIPs | 10.10.0.2/32 | 10.10.0.1/32, 10.0.0.0/23 |
| Latency | ~24ms round trip | ~24ms round trip |

**IP forwarding (Chicago):** `net.ipv4.ip_forward = 1` in /etc/sysctl.conf  
**MASQUERADE (Chicago):** NAT rule in /etc/ufw/before.rules — Dallas traffic to VLAN appears as 10.0.0.4  
**Forwarding rules (Chicago):** ufw-before-forward allows wg0 ↔ eth1

### SERVER_ROLE Gating

The `SERVER_ROLE` environment variable controls cron jobs and notification delivery:

| Value | Crons | SMS/Email | Use case |
|-------|-------|-----------|----------|
| `primary` | Run | Send | Production web server |
| `standby` | Disabled | Console only | Dallas warm standby |
| (undefined) | Run | Console if no creds | Local development |

### DNS Configuration

| Record | Value | Provider | TTL |
|--------|-------|----------|-----|
| obitnote.com A | 103.90.163.56 | Cloudflare | 60s |
| www.obitnote.com CNAME | obitnote.com | Cloudflare | 60s |
| stage.obitnote.com A | 146.71.78.194 | Cloudflare | 60s |
| pb.obitnote.com A | 43.231.235.200 | Cloudflare | 60s |
| MX (obitnote.com) | mx.zoho.com (priority 10) | Cloudflare | Auto |
| SPF TXT | v=spf1 include:zoho.com ~all | Cloudflare | Auto |
| DKIM TXT | zoho._domainkey | Cloudflare | Auto |
| DMARC TXT | v=DMARC1; p=none | Cloudflare | Auto |
| obitnotes.com A | 103.90.163.56 | GoDaddy | 600s |
| www.obitnotes.com A | 103.90.163.56 | GoDaddy | 600s |

**DNS provider:** Cloudflare (free plan, DNS-only mode — no proxy).  Domain registered at GoDaddy, nameservers pointed to Cloudflare (`clyde.ns.cloudflare.com`, `leia.ns.cloudflare.com`).  obitnotes.com remains on GoDaddy DNS (redirect domain only).

### obitnotes.com Redirect

The alternate domain `obitnotes.com` (with an 's') redirects all traffic to `obitnote.com`.

- **DNS:** Both `obitnotes.com` and `www.obitnotes.com` resolve to 103.90.163.56 (production web server)
- **nginx:** Separate server block (`/etc/nginx/sites-available/obitnotes`) proxies all requests to `/api/internal/redirect-log`
- **API:** The redirect-log endpoint logs the visitor IP to the `redirect_log` table, then sends a 301 to `https://obitnote.com`
- **SSL:** Separate Let's Encrypt cert covers `obitnotes.com` + `www.obitnotes.com`
- **Redirect chain:** `http(s)://obitnotes.com/*` → 301 → `https://obitnote.com/*`

### SSL/TLS

- Let's Encrypt via certbot (auto-renewal systemd timer)
- Production cert (Chicago): `obitnote.com` + `www.obitnote.com` — HTTP-01 validation
- Dallas standby cert: `obitnote.com` + `www.obitnote.com` — DNS-01 validation via Cloudflare API (pre-staged for failover)
- Alternate domain cert: `obitnotes.com` + `www.obitnotes.com`
- Staging cert: `stage.obitnote.com`
- www → bare domain 301 redirect (both HTTP and HTTPS)

---

## 6. Deployment

### Deployment Process

Deployment is manual — code is built on the dev server, tarballed, uploaded via SCP over the private VLAN, extracted, and services restarted.

### Step-by-Step Deploy to Production

```bash
# 1. On dev server — stamp version and create tarballs
cd /c/dev/obit-projects/obit-person
cd client && npm run stamp && cd ..

tar czf /tmp/search.tar.gz --exclude='node_modules' --exclude='.expo' \
    --exclude='dist' --exclude='.git' --exclude='search_test_data' \
    --exclude='data/cache' --exclude='.env' -C . search/

tar czf /tmp/api.tar.gz --exclude='node_modules' --exclude='.expo' \
    --exclude='dist' --exclude='.git' --exclude='.env' -C . api/

tar czf /tmp/client.tar.gz --exclude='node_modules' --exclude='.expo' \
    --exclude='web-build' --exclude='dist' --exclude='.git' \
    --exclude='.env' -C . client/

# 2. Upload to production (via VLAN)
scp /tmp/search.tar.gz /tmp/api.tar.gz /tmp/client.tar.gz \
    obitnote_admin@10.0.0.4:/tmp/

# 2b. Upload to staging
scp /tmp/search.tar.gz /tmp/api.tar.gz /tmp/client.tar.gz \
    obitnote_admin@146.71.78.194:/tmp/

# 3. SSH to production
ssh obitnote_admin@10.0.0.4

# 4. Extract (preserves server .env files)
cd /var/www/obitnote
tar xzf /tmp/search.tar.gz
tar xzf /tmp/api.tar.gz
tar xzf /tmp/client.tar.gz

# 5. Rebuild services (as needed)
# Search engine:
cd /var/www/obitnote/search && npm install && pm2 restart search

# API server:
cd /var/www/obitnote/api && npm install && npm run build && pm2 restart api

# Client:
cd /var/www/obitnote/client && npm install && npm run build:web
cp /var/www/obitnote/client/assets/favicon.ico /var/www/obitnote/client/dist/
cp /var/www/obitnote/client/assets/apple-touch-icon.png /var/www/obitnote/client/dist/
cp /var/www/obitnote/client/assets/icon-192.png /var/www/obitnote/client/dist/
cp /var/www/obitnote/client/assets/icon-512.png /var/www/obitnote/client/dist/
cp /var/www/obitnote/client/assets/manifest.json /var/www/obitnote/client/dist/
sed -i 's|</head>|<link rel="apple-touch-icon" href="/apple-touch-icon.png" /><link rel="manifest" href="/manifest.json" /><meta name="theme-color" content="#663399" /></head>|' /var/www/obitnote/client/dist/index.html

# 6. Run migrations (if new migration files)
cd /var/www/obitnote/search && node src/db/migrate.js
cd /var/www/obitnote/api && npx tsx src/db/migrate.ts
```

### Critical .env Files (NOT in repo — server-only)

**api/.env (production):**
```
DATABASE_URL=postgres://onadmin:ondata@10.0.0.2:5432/dw
JWT_SECRET=<secret>
APP_URL=https://obitnote.com
API_URL=https://obitnote.com
SEARCH_ENGINE_URL=http://localhost:3000
ZOHO_SMTP_PASSWORD=<secret>
PADDLE_API_KEY=<secret>
PADDLE_WEBHOOK_SECRET=<secret>
SINCH_PROJECT_ID=<secret>
SINCH_KEY_ID=<secret>
SINCH_KEY_SECRET=<secret>
SINCH_FROM_NUMBER=+12013619440
GEOLITE_DB_PATH=/var/www/obitnote/data/GeoLite2-City.mmdb
NODE_ENV=production
```

**client/.env (production):**
```
EXPO_PUBLIC_API_BASE_URL=https://obitnote.com
```

**search/.env (production):**
```
SEARCH_PROVIDER=serper
SERPER_API_KEY=<secret>
DATABASE_URL=postgres://onadmin:ondata@10.0.0.2:5432/dw
```

### Known Deploy Gotchas

1. **NEVER include .env in tarballs** — local .env has localhost URLs, overwriting server .env breaks everything
2. **API runs from dist/** — must `npm run build` (tsc) after deploying new TypeScript source
3. **Client .env is baked at build time** — wrong EXPO_PUBLIC_API_BASE_URL requires full rebuild with `--clear`
4. **PM2 needs --update-env** to pick up .env changes: `pm2 restart api --update-env`
5. **expo-secure-store crashes on web** — must stay uninstalled
6. **Must use --no-minify** — minification breaks expo-modules-core class name detection
7. **nginx gzip** compensates for unminified bundle size (3MB → 616KB transfer)

---

## 7. Scheduled Jobs & Automation

### node-cron Jobs (in API server process)

| Schedule (UTC) | Schedule (ET) | Job | Description |
|---------------|--------------|-----|-------------|
| `0 16 * * *` | 11:00 AM | Daily batch search | Searches Serper for all active queries, stores matches, sends notifications |
| `30 16 * * *` | 11:30 AM | Batch verification | Checks batch_log: did it run? still running? failures? |
| `0 14 1 * *` | 9:00 AM 1st | Monthly summary | Email subscribers their monthly search stats |
| `0 */6 * * *` | Every 6 hrs | Database health | Checks DB reachable + size under 1GB threshold |
| `10 2 * * *` | 10:10 PM | Backup verification | Checks backup_log for today's successful entry |

### System Crontab (on web server: 10.0.0.4)

| Schedule (UTC) | Schedule (ET) | Script | Description |
|---------------|--------------|--------|-------------|
| `0 2 * * *` | 10:00 PM | `/home/obitnote_admin/backup-db.sh` | pg_dump + iDrive upload + report to API |
| `0 */6 * * *` | Every 6 hrs | `/home/obitnote_admin/check-disk.sh` | Disk space check (alerts at 85%) |

### System Crontab (on Dallas standby: 43.231.235.200)

| Schedule (UTC) | Schedule (ET) | Script | Description |
|---------------|--------------|--------|-------------|
| `*/2 * * * *` | Every 2 min | `/var/www/obitnote/obitnote_roundrobin_check.js` | Health check + auto-failover (SMS + email alerts) |

### Daily Batch Search Flow

```
[11:00 AM ET - Cron fires]
    |
    v
Purge dismissed results > 7 days old
    |
    v
INSERT batch_log (status='running')
    |
    v
For each active user_query (not confirmed, no pending results):
    |
    +-- Call search engine: GET /search?firstName=...&lastName=...
    |       |
    |       v
    |   Serper.dev API → Google search results
    |       |
    |       v
    |   Normalize (names, dates, locations)
    |       |
    |       v
    |   Score (6 criteria) + Fingerprint + Dedupe
    |       |
    |       v
    |   Filter exclusions → Return ranked results
    |
    v
Compare fingerprints to existing results (skip duplicates)
    |
    v
INSERT new results into user_result (status='pending', source_type='batch')
    |
    v
UPDATE batch_log (status='completed', stats)
    |
    v
For each user with new unread batch results:
    +-- Send email notification
    +-- Send SMS (if opted in)
```

---

## 8. Monitoring & Alerting

### Fatal Error Alerting System

When a critical error occurs anywhere in the system, it triggers:
1. SMS to the on-call Support Chief (rate-limited: max 3 SMS per 3 minutes)
2. Email to support@obitnote.com and james.jones@obitnote.com
3. Record in `fatal_error` database table

**SMS Format:** `ObitNote FATAL ERROR: {source} produced error {code} timestamp {YYYYMMDD HH:MM} UTC.`

### Error Sources

| Source | Trigger | Location |
|--------|---------|----------|
| serper | Non-2xx Serper API response | search/src/providers/serper/ |
| database | PostgreSQL pool error (search) | search/src/db/pool.js |
| search | Unhandled Express error (search) | search/src/api/server.js |
| database | PostgreSQL pool error (API) | api/src/db/pool.ts |
| api | Unhandled Express error (API) | api/src/index.ts |
| paddle | Webhook signature/processing failure | api/src/routes/webhooks.ts |
| paddle | Paddle API non-2xx response | api/src/services/paddleService.ts |
| email | SMTP delivery failure | api/src/services/emailService.ts |
| sms | Sinch delivery failure | api/src/services/smsService.ts |
| batch | Per-query search failure | api/src/services/batchService.ts |
| batch | Daily cron crash or verification failure | api/src/index.ts, backupService.ts |
| backup | pg_dump or iDrive failure | api/src/services/backupService.ts |
| database | DB unreachable or size over threshold | api/src/services/backupService.ts |
| disk | Web server disk usage >= 85% | check-disk.sh |

### Round Robin Health Check + Auto-Failover

**Script:** `/var/www/obitnote/obitnote_roundrobin_check.js` on Dallas (ON-PB-DAL-1)
**Schedule:** Every 2 minutes via crontab (`*/2 * * * *`)
**Log:** `/var/log/obitnote/roundrobin.log`
**State:** `/var/www/obitnote/data/roundrobin-state.json` (alert suppression tracking)
**Failover marker:** `/var/www/obitnote/data/failover-executed.json` (created on auto-failover)

Runs on Dallas because it can detect Chicago failures — the most critical scenario.

**20 checks across 4 servers:**

| Server | Checks |
|--------|--------|
| ON-PB-DAL-1 (Dallas) | PM2, PG replica status, replication lag, VPN tunnel, API health, disk |
| ON-WB-CHI-1 (Prod Web) | SSH, PM2, API health, HTTPS (obitnote.com), disk |
| ON-DB-CHI-1 (Prod DB) | Ping, PostgreSQL connectivity, disk |
| ON-ST-CHI-1 (Staging) | SSH, PM2, API health, HTTPS, disk (optional — skipped when offline) |

**Alerting:**
- SMS + email to Support Chief on Call + Jim Jones (+19044770311, jimjones1000@gmail.com)
- Direct Sinch/Zoho calls — bypasses SERVER_ROLE=standby gating
- Max 3 consecutive alerts per failing check, then suppressed
- Recovery notifications sent when a check passes after failing

**Replication lag check:** Compares WAL receive/replay positions first.  If both match, the primary is idle and the replica is caught up regardless of timestamp age.  Only alerts when receive LSN > replay LSN and lag exceeds 5 minutes.

**Auto-failover trigger:** If BOTH `prodWeb:ssh` (SSH to 103.90.163.56) AND `prodWeb:https` (public HTTPS to obitnote.com) fail for 5 consecutive checks (10 minutes), the script automatically fails over to Dallas.  Requiring both paths prevents false positives from VPN glitches or transient network issues.

**Auto-failover steps (performed automatically):**
1. Check if Chicago DB is reachable via VPN
   - **DB alive:** Point DATABASE_URL to 10.0.0.2 via VPN (Scenario A: web server failure)
   - **DB unreachable:** Promote PostgreSQL replica to primary (Scenario C: full outage)
2. Set `SERVER_ROLE=primary` in api/.env
3. Restart PM2 with `--update-env`
4. Start nginx (SSL cert pre-staged via certbot + Cloudflare DNS-01 validation)
5. Update Cloudflare DNS: obitnote.com A record → 43.231.235.200 (60s TTL)
6. Create failover marker file (prevents re-execution on subsequent runs)
7. Send AUTO-FAILOVER alert via SMS + email

**After auto-failover:** The script continues running every 2 minutes in failover mode, skipping replica-specific checks.  Chicago checks will still fail and be reported (suppressed after 3 alerts).  Manual intervention required to restore Chicago — see "Switch Back to Chicago" in Section 9.

**DNS managed by Cloudflare** (moved from GoDaddy for API access):
- Zone ID: `6b99b2b4620c2991edf3d7459ae642a2`
- API token in Dallas api/.env (`CLOUDFLARE_API_TOKEN`)
- Nameservers: `clyde.ns.cloudflare.com`, `leia.ns.cloudflare.com`

**SSL on Dallas:** Pre-staged via certbot with Cloudflare DNS-01 plugin.  Auto-renews via certbot systemd timer.  No delay during failover — cert exists before it's needed.

### External Monitoring

| Service | What it monitors | Alerts |
|---------|-----------------|--------|
| UptimeRobot | obitnote.com HTTPS availability | Email |
| Betterstack | obitnote.com HTTPS availability | Email, Slack |

### Monitoring Tables

| Table | Purpose | Retention |
|-------|---------|-----------|
| fatal_error | Every fatal alert event + SMS delivery status | Indefinite |
| batch_log | Daily batch run statistics | Indefinite |
| backup_log | Daily backup status | Indefinite |
| error_log | Client-side JavaScript errors | Indefinite |

---

## 9. Backup & Disaster Recovery

### Backup Strategy

```
[10:00 PM ET daily]
    |
    v
pg_dump --> /var/backups/postgresql/dw_YYYYMMDD.sql.gz
    |
    v
iDrive upload (off-site, Chicago → iDrive cloud)
    |
    v
curl POST /api/internal/backup-report (success/failure + file size)
    |
    v
Delete local backups > 30 days old

[10:10 PM ET daily]
    |
    v
API cron checks backup_log for today's successful entry
    |
    v
If missing: SMS + email alert
```

**Local retention:** 30 days on web server (`/var/backups/postgresql/`)  
**Off-site retention:** 90 days on iDrive

### Disaster Recovery Procedures

**Geographic redundancy:** Dallas warm standby (ON-PB-DAL-1) provides fast failover for all scenarios below.  PostgreSQL streaming replication keeps Dallas data within seconds of production.

#### Scenario A: Web Server Failure (DB still alive)

**Failover to Dallas (minutes, not hours):**

1. SSH to Dallas: `ssh obitnote_admin@43.231.235.200`
2. Verify VPN tunnel: `wg show` and `ping -c 1 10.0.0.2`
3. Change DATABASE_URL to point through VPN:
   ```bash
   # In /var/www/obitnote/api/.env and search/.env:
   DATABASE_URL=postgresql://onadmin:ondata@10.0.0.2:5432/dw
   ```
4. Change `SERVER_ROLE=primary` in api/.env
5. `pm2 restart all --update-env`
6. Start nginx: `sudo systemctl start nginx` (SSL cert pre-staged)
7. Update Cloudflare DNS: obitnote.com A record → 43.231.235.200 (auto-failover does this automatically)
8. Verify: `curl https://obitnote.com/api/health` (after DNS propagates, ~60s)

**Time estimate:** ~10 minutes (automatic), 5 minutes (manual)
**Data loss:** Seconds (streaming replication)

#### Scenario B: Database Server Failure (web still alive)

**Promote Dallas replica:**

1. SSH to Dallas: `ssh obitnote_admin@43.231.235.200`
2. Promote: `sudo pg_ctlcluster 16 main promote`
3. On Chicago web server, update api/.env and search/.env:
   ```bash
   DATABASE_URL=postgresql://onadmin:ondata@10.10.0.2:5432/dw
   ```
4. `pm2 restart all --update-env` on Chicago web server
5. Set up backup-db.sh on Dallas for pg_dump + iDrive
6. Verify: `psql -h 10.10.0.2 -U onadmin dw -c "SELECT 1"`

**Time estimate:** 5-10 minutes  
**Data loss:** Seconds (streaming replication)

#### Scenario C: Full Chicago Datacenter Outage

**Dallas takes over everything:**

1. SSH to Dallas: `ssh obitnote_admin@43.231.235.200`
2. Promote PG replica: `sudo pg_ctlcluster 16 main promote`
3. DATABASE_URL already points to localhost — no change needed
4. Change `SERVER_ROLE=primary` in api/.env
5. `pm2 restart all --update-env`
6. Start nginx: `sudo systemctl start nginx` (SSL cert pre-staged)
7. Update Cloudflare DNS: obitnote.com A record → 43.231.235.200 (auto-failover does this automatically)
8. Set up backup-db.sh crontab for local pg_dump + iDrive
9. Verify: `curl https://obitnote.com/api/health`

**Time estimate:** ~10 minutes (automatic), 5-10 minutes (manual)
**Data loss:** Seconds (streaming replication)

#### After Recovery: Switch Back to Chicago

Once Chicago servers are repaired/rebuilt, follow these steps to restore the original configuration (Chicago primary, Dallas standby).

**Prerequisites:** Chicago web server (ON-WB-CHI-1) and DB server (ON-DB-CHI-1) are back online.  WireGuard tunnel is re-established (`ping -c 1 10.10.0.2` from Chicago succeeds).

**Step 1: Copy data from Dallas to Chicago DB**

```bash
# On Dallas (currently the primary), dump the database:
sudo -u postgres pg_dump -Fc dw > /tmp/dw_recovery.dump

# SCP to Chicago web server, then to DB server:
scp /tmp/dw_recovery.dump obitnote_admin@103.90.163.56:/tmp/
# From Chicago web server:
scp /tmp/dw_recovery.dump obitnote_admin@10.0.0.2:/tmp/

# On Chicago DB server, restore:
sudo -u postgres dropdb dw
sudo -u postgres createdb -O onadmin dw
sudo -u postgres pg_restore -d dw /tmp/dw_recovery.dump
```

**Step 2: Re-establish streaming replication (Chicago primary → Dallas replica)**

```bash
# On Dallas, stop the application and PostgreSQL:
pm2 stop all
sudo systemctl stop postgresql

# Clear Dallas data directory and re-basebackup from Chicago:
sudo -u postgres bash -c 'rm -rf /var/lib/postgresql/16/main/*'
sudo -u postgres bash -c 'PGPASSWORD=ondata pg_basebackup -h 10.0.0.2 -U replicator -D /var/lib/postgresql/16/main -Fp -Xs -P -R'
sudo systemctl start postgresql

# Verify Dallas is back in replica mode:
sudo -u postgres psql -c "SELECT pg_is_in_recovery();"   # should be 't'
```

**Step 3: Restore Dallas to standby mode**

```bash
# On Dallas, update api/.env:
#   SERVER_ROLE=standby
#   DATABASE_URL=postgresql://onadmin:ondata@localhost:5432/dw
pm2 restart all --update-env
sudo systemctl stop nginx
```

**Step 4: Point traffic back to Chicago**

```bash
# On Chicago web server, update api/.env and search/.env:
#   DATABASE_URL=postgresql://onadmin:ondata@10.0.0.2:5432/dw
#   SERVER_ROLE=primary
pm2 restart all --update-env

# Update Cloudflare DNS: obitnote.com A record → 103.90.163.56
# Via dashboard (dash.cloudflare.com → obitnote.com → DNS) or API:
curl -X PUT "https://api.cloudflare.com/client/v4/zones/6b99b2b4620c2991edf3d7459ae642a2/dns_records/825d5eae8f6ba96076a74495e778533b" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"A","name":"obitnote.com","content":"103.90.163.56","ttl":60,"proxied":false}'
```

**Step 5: Remove failover marker and reset alert state**

```bash
# On Dallas:
rm /var/www/obitnote/data/failover-executed.json
rm /var/www/obitnote/data/roundrobin-state.json
```

**Step 6: Verify**

```bash
# From Chicago:
curl -s http://localhost:3001/api/health
pm2 logs api --lines 5 --nostream   # should show crons running

# From Dallas:
sudo -u postgres psql -c "SELECT pg_is_in_recovery();"   # true
pm2 logs api --lines 5 --nostream   # should show standby message

# From Chicago DB:
sudo -u postgres psql -c "SELECT client_addr, state FROM pg_stat_replication;"   # Dallas streaming

# Run health check to confirm clean state:
node /var/www/obitnote/obitnote_roundrobin_check.js
```

#### Scenario: Code Corruption / Bad Deploy

1. **Rollback:** Re-deploy previous version from git
2. **Or restore from last known-good tarball** (keep recent tarballs in /tmp)
3. **Restart services:** `pm2 restart all`

#### Scenario: Database Corruption (No Server Loss)

1. **Stop API/Search:** `pm2 stop all`
2. **Assess damage:** `psql -h 10.0.0.2 -U onadmin dw` — check table integrity
3. **If minor:** Targeted fixes via SQL
4. **If severe:** Promote Dallas replica (see Scenario B) or full restore from backup
5. **Restart:** `pm2 start all`

### Backup Script Location

- **Script:** `/home/obitnote_admin/backup-db.sh` on web server (10.0.0.4)
- **Backup directory:** `/var/backups/postgresql/` on web server
- **iDrive binary:** `/opt/IDriveForLinux/bin/idrive` on web server
- **iDrive account:** jim.jones@musicdatasystems.com (see Credentials section)

---

## 10. Third-Party Services & Credentials

### Credential Inventory

All credentials are stored in `.env` files on the respective servers.  Jim Jones has all credentials.  In the event credentials are lost, each service has an account recovery process via the registered email.

| Service | Purpose | Account Email | Credential Location | How to Obtain |
|---------|---------|--------------|---------------------|---------------|
| **Kamatera** | Server hosting | jim.jones@musicdatasystems.com | Browser saved/password manager | kamatera.com account recovery |
| **GoDaddy** | Domain registrar (nameservers → Cloudflare) | jimjones1000@gmail.com | Password manager | godaddy.com account recovery |
| **Cloudflare** | DNS management + API (auto-failover) | james.jones@obitnote.com | api/.env on Dallas (CLOUDFLARE_*) | dash.cloudflare.com |
| **Paddle** | Payment processing | jim.jones@obitnote.com | api/.env (PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET) | paddle.com vendor dashboard |
| **Serper.dev** | Google search API | jimjones1000@gmail.com | search/.env (SERPER_API_KEY) | serper.dev dashboard |
| **Zoho Mail** | SMTP email sending | james.jones@obitnote.com | api/.env (ZOHO_SMTP_PASSWORD) | Zoho admin console |
| **Sinch** | SMS sending | jim.jones@musicdatasystems.com | api/.env (SINCH_*) | Sinch dashboard |
| **Let's Encrypt** | SSL certificates | admin@obitnote.com | Auto-managed by certbot | Automatic renewal |
| **MaxMind** | GeoIP database (GeoLite2) | jimjones1000@gmail.com | File on server (/var/www/obitnote/data/) | maxmind.com account |
| **iDrive** | Off-site backup storage | jim.jones@musicdatasystems.com | Configured in idrive CLI on server | idrive.com account |
| **UptimeRobot** | Uptime monitoring | jimjones1000@gmail.com | Web dashboard | uptimerobot.com |
| **Betterstack** | Uptime monitoring | jimjones1000@gmail.com | Web dashboard | betterstack.com |

### Paddle.com (Payment Provider)

- **Role:** Merchant of record — handles all payments, tax/VAT, invoicing, refunds
- **Fees:** 5% + $0.50 per transaction
- **Dashboard:** vendors.paddle.com
- **Webhook URL:** `https://obitnote.com/api/webhooks/paddle`
- **Webhook events:** subscription.created, subscription.activated, subscription.updated, subscription.canceled
- **Client token:** Used in browser for Paddle.js checkout overlay
- **API key:** Used server-side for subscription management (create, update quantity, cancel)

### Serper.dev (Search API)

- **Role:** Google search results via API (obituary searches)
- **Credits:** 50,000 purchased
- **Usage:** ~1 credit per search query per day per active user
- **Dashboard:** serper.dev
- **Rate limit:** None specified; ~30 queries/batch currently

### Zoho Mail (Email)

- **Role:** SMTP sending for all transactional emails
- **SMTP server:** smtp.zoho.com:465 (SSL)
- **From address:** support@obitnote.com
- **Alias of:** james.jones@obitnote.com
- **Forwarding:** Incoming email forwarded to jimjones1000@gmail.com
- **Dev mode:** When ZOHO_SMTP_PASSWORD is not set, emails log to console only

### Sinch (SMS)

- **Role:** SMS notifications (match alerts, fatal error alerts)
- **Phone number:** +12013619440 (NJ local, area code 201)
- **SDK:** @sinch/sdk-core (Node.js), configured with `smsRegion: 'us'`
- **Status:** Operational (fixed 2026-05-18 — wrong FROM number in .env; corrected from +12066493599 to +12013619440)
- **10DLC:** Brand registration approved (UltraSafe Data, id: 01kpxm61qryxgm58s32dc4tqce).  Campaign registration not yet submitted but SMS delivering without it.

### MaxMind GeoLite2

- **Role:** IP geolocation for login history (city, state, country)
- **Database file:** GeoLite2-City.mmdb
- **Location:** /var/www/obitnote/data/ on both prod and staging
- **Updates:** Manual download from MaxMind account (free tier, quarterly updates)

---

## 11. Security

### Authentication

- **Method:** JWT (JSON Web Tokens) with bcrypt password hashing
- **Token expiry:** Set in JWT_SECRET configuration
- **Session handling:** Client stores JWT in localStorage; 60-second background refresh
- **Rate limiting:** 5 registrations/hour, 20 auth attempts/15min, 30 searches/minute
- **Email verification:** Soft gate (can use app, banner reminds to verify)

### Server Hardening

- Root SSH disabled on all servers (PermitRootLogin no)
- All servers use `obitnote_admin` with passwordless sudo
- UFW firewall (22, 80, 443 on web server; 80, 443 on staging; nothing public on DB)
- Staging port 22 closed on public interface (SSH via private VLAN only)
- Helmet.js security headers on API
- PostgreSQL accessible only from web server IP via pg_hba.conf
- DB server has no public IP address

### Application Security

- CORS enabled
- Webhook signature verification (Paddle HMAC-SHA256)
- Internal API endpoints restricted to localhost (IP check)
- 16-second search creation throttle (anti-bot)
- Express rate limiting on all public endpoints
- No raw SQL interpolation (parameterized queries throughout)

### Security Incident History

- **2026-04-18:** Russian intrusion detected on musicdatasystems.com server (RAM-only, no persistence).  All credentials rotated.  Sinch API key regenerated.  SSH keys changed.  All servers moved to key-only auth.

### Recommended Future Hardening

- CAPTCHA on registration
- Hard email verification before first search (currently soft gate)
- Fail2ban for SSH brute force
- PM2 --max-memory-restart safety net
- Log rotation for backup.log and check-disk.log

---

## 12. Admin Capabilities

### Admin Pages (accessible via Settings menu when user.is_admin = true)

| Page | URL | Purpose |
|------|-----|---------|
| Activity | /admin/activity | User action log (sortable, clickable names, geo data) |
| Users | /admin/users | All users with stats, tier management, impersonation |
| Messages | /admin/messages | Support ticket management with reply |
| Error Log | /admin/errors | Client-side JS errors (date range, search, sort) |
| Support Chief | /admin/oncall | On-call roster + fatal error log |

### Admin Features

- **Impersonation:** JWT swap to view app as any user; yellow banner + "Return to Admin" button
- **Tier management:** Change user plan/cap via user detail modal
- **Trial reset:** Reset trial search count to 0
- **Support replies:** Reply to user messages (triggers notification email)
- **Error monitoring:** Real-time client error visibility with user attribution
- **Fatal error visibility:** Today's count shown as badge on Support Chief nav item

---

## 13. Billing & Subscription Management

### Pricing

| Plan | People | Annual Price | Paddle Price ID (Production) |
|------|--------|-------------|------------------------------|
| Basic | 1-5 | $20 flat | pri_01krhq4c78j0c0d0gvhasxp2p0 |
| Plus | 6+ | $4/person/year | pri_01krhmxw12mseqdjbj7napcaya |

### Subscription Lifecycle

```
User registers (free)
    |
    v
Free trial (2-3 searches on known deceased)
    |
    v
Subscribes via Paddle checkout (Basic $20/yr)
    |
    v
Adds people (up to 5 on Basic)
    |
    v
Adds person #6 → auto-upgrade to Plus
    |   (single Paddle API call: swap to Plus price, set quantity)
    v
Ongoing: quantity synced on add/delete/confirm/unconfirm
    |
    v
Cancel → immediate, prorated refund via Paddle
```

### Plan Enforcement

- **Basic:** Hard cap at 5 active, non-confirmed searches
- **Plus:** No cap; billed per-person (quantity = total people monitored)
- **Confirmed searches:** Don't count toward billing (monitoring stopped)
- **Deleted searches:** Free up slots immediately
- **Plan codes in DB:** PLAN_5 (Basic), PLAN_10 (Plus), PLAN_CUSTOM (admin-managed)

---

## 14. Runbooks

### Runbook: Daily Operations Check

**Frequency:** Daily, after 11:30 AM ET

1. Check email for fatal error alerts
2. Visit admin panel → Support Chief → review fatal error log
3. Check Messages for new support tickets
4. Check Error Log for new client errors
5. Optional: Check batch_log in DB for today's stats

### Runbook: Respond to Fatal Error SMS

1. Read SMS — note source and error code
2. SSH to production: `ssh obitnote_admin@10.0.0.4` (from dev server)
3. Check PM2 logs: `pm2 logs api --lines 50` or `pm2 logs search --lines 50`
4. Check if services are running: `pm2 status`
5. If process crashed: `pm2 restart api` or `pm2 restart search`
6. If DB issue: Test connectivity: `psql -h 10.0.0.2 -U onadmin dw -c "SELECT 1"`
7. If Serper issue: Check serper.dev dashboard for quota/status
8. If Paddle issue: Check paddle.com vendor dashboard for webhook health

### Runbook: Deploy Code Update

See [Section 6: Deployment](#6-deployment) for full step-by-step.

### Runbook: Rotate Credentials

1. **Paddle API key:** Vendor dashboard → Developer Tools → API Keys → Generate new → Update api/.env → `pm2 restart api --update-env`
2. **Zoho SMTP:** Zoho admin → Mail → App passwords → Generate → Update api/.env → `pm2 restart api --update-env`
3. **Serper API key:** serper.dev → API Keys → Regenerate → Update search/.env → `pm2 restart search`
4. **Sinch:** Sinch dashboard → Access Keys → Create new, revoke old → Update api/.env → `pm2 restart api --update-env`
5. **JWT_SECRET:** Update api/.env → `pm2 restart api --update-env` (NOTE: invalidates all existing user sessions)
6. **Database password:** `ALTER USER onadmin WITH PASSWORD 'newpass';` on DB → Update all .env files → Restart all PM2 processes

### Runbook: SSL Certificate Issue

Certbot auto-renews.  If it fails:

1. SSH to web server
2. Check: `sudo certbot certificates`
3. Force renewal: `sudo certbot renew --force-renewal`
4. If domain validation fails: Check Cloudflare DNS A records point to correct IP (dash.cloudflare.com → obitnote.com → DNS)
5. Restart nginx: `sudo systemctl restart nginx`

### Runbook: Disk Space Alert

Triggered at 85% usage.

1. SSH to web server
2. Check: `df -h`
3. Check backup accumulation: `du -sh /var/backups/postgresql/`
4. Remove old backups if needed: `find /var/backups/postgresql/ -mtime +30 -delete`
5. Check PM2 logs: `du -sh ~/.pm2/logs/` — rotate if large
6. Check journal: `sudo journalctl --vacuum-time=7d`

### Runbook: Database Restore from Backup

1. Stop API/Search: `pm2 stop all` (on web server)
2. List available backups: `ls -la /var/backups/postgresql/`
3. Restore: `gunzip -c /var/backups/postgresql/dw_YYYYMMDD.sql.gz | psql -h 10.0.0.2 -U onadmin dw`
4. If local backup is corrupt/missing, download from iDrive:
   ```bash
   cd /opt/IDriveForLinux/bin
   ./idrive --restore  # interactive, select file
   ```
5. Verify: `psql -h 10.0.0.2 -U onadmin dw -c "SELECT count(*) FROM dw_user"`
6. Restart: `pm2 start all`

### Runbook: Round Robin Health Check

**Script:** `/var/www/obitnote/obitnote_roundrobin_check.js` on Dallas (ON-PB-DAL-1)
**Runs automatically** every 2 minutes via crontab.  See Section 8 for check details, alerting, and auto-failover behavior.

```bash
# Manual run
ssh obitnote_admin@43.231.235.200 "node /var/www/obitnote/obitnote_roundrobin_check.js"

# View recent log
ssh obitnote_admin@43.231.235.200 "tail -100 /var/log/obitnote/roundrobin.log"

# View alert suppression state
ssh obitnote_admin@43.231.235.200 "cat /var/www/obitnote/data/roundrobin-state.json"

# Reset suppression (re-enables alerts for all checks)
ssh obitnote_admin@43.231.235.200 "rm /var/www/obitnote/data/roundrobin-state.json"

# Check if auto-failover has been executed
ssh obitnote_admin@43.231.235.200 "cat /var/www/obitnote/data/failover-executed.json 2>/dev/null || echo 'No failover'"

# Remove failover marker (after restoring Chicago — see Section 9)
ssh obitnote_admin@43.231.235.200 "rm /var/www/obitnote/data/failover-executed.json"
```

### Runbook: Failover to Dallas Standby

**This failover is now AUTOMATIC.**  The round robin script auto-fails over after 10 minutes of Chicago web unreachability (see Section 8).  The steps below are for manual failover if the script hasn't triggered, or for reference.

1. SSH to Dallas: `ssh obitnote_admin@43.231.235.200`
2. Check replication status: `sudo -u postgres psql -c "SELECT pg_is_in_recovery();"`
3. If DB failover needed, promote replica: `sudo pg_ctlcluster 16 main promote`
4. If using Chicago DB through VPN, verify tunnel: `wg show` and `ping -c 1 10.0.0.2`
5. Update api/.env:
   - `SERVER_ROLE=primary`
   - `DATABASE_URL=postgresql://onadmin:ondata@localhost:5432/dw` (promoted replica) or `@10.0.0.2:5432/dw` (Chicago DB via VPN)
6. `pm2 restart all --update-env`
7. Start nginx: `sudo systemctl start nginx` (SSL cert already pre-staged)
8. DNS: Update Cloudflare obitnote.com A record → 43.231.235.200 (via dashboard or API)
9. Verify: `curl https://obitnote.com/api/health`
10. Set up backup-db.sh crontab if running on local DB
11. Create failover marker: `echo '{"executedAt":"'$(date -u +%FT%TZ)'","scenario":"manual"}' > /var/www/obitnote/data/failover-executed.json`

### Runbook: Verify Dallas Standby Health

**Automated:** The round robin health check (every 2 min) monitors all of these.  See Section 8.
**Manual verification** after deploys or suspected issues:

```bash
ssh obitnote_admin@43.231.235.200
# VPN tunnel
ping -c 1 10.0.0.2
# Replication mode
sudo -u postgres psql -c "SELECT pg_is_in_recovery();"   # should be 't'
# Replication lag (WAL positions should match; timestamp lag is normal when primary is idle)
sudo -u postgres psql -c "SELECT pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn() AS caught_up, NOW() - pg_last_xact_replay_timestamp() AS timestamp_lag;"
# API health
curl -s http://localhost:3001/api/health
# PM2 status
pm2 status
# Crons disabled
pm2 logs api --lines 5 --nostream | grep standby
# Recent round robin results
tail -30 /var/log/obitnote/roundrobin.log
```

### Runbook: Add New Support Staff (On-Call)

1. Admin panel → Support Chief page
2. Click "Add Staff" → enter name and phone number
3. Set as on-call (only one at a time)
4. Test: trigger a test fatal error via curl:
   ```bash
   curl -X POST http://localhost:3001/api/internal/fatal-error \
     -H "Content-Type: application/json" \
     -d '{"source":"test","errorCode":"TEST","message":"Test alert"}'
   ```

---

## 15. Development Environment

### Prerequisites

- Node.js 20+
- PostgreSQL (any recent version; dev uses 18)
- Git
- GitHub CLI (`gh`) — for monitoring CI status after pushes

### Local Setup

```bash
git clone <repo-url> obit-person
cd obit-person

# Database (create if first time)
# psql: CREATE DATABASE dw; CREATE USER dwadmin WITH PASSWORD 'dwdata'; ALTER USER dwadmin WITH SUPERUSER;

# Search engine
cd search && npm install && npm run db:migrate && cd ..

# API server
cd api && npm install && npm run migrate && cd ..

# Client
cd client && npm install && cd ..

# Start all services (from root)
npm run dev
```

### Development Ports

| Service | Port | URL |
|---------|------|-----|
| Search Engine | 3000 | http://localhost:3000 |
| API Server | 3001 | http://localhost:3001 |
| Expo Dev Server | 8081 | http://localhost:8081 |

### CI / GitHub Actions

- **Trigger:** Every push to main runs `npx tsc --noEmit` on both client and API
- **Monitor after push:** `gh run list --limit 1` then `gh run view <id> --log-failed` if it fails
- **Known gotcha:** `.gitignore` pattern `data/` can exclude files under `client/src/data/` — use `git add -f` for those files

### Code Conventions

- **Database columns:** snake_case (`name_first`, `score_final`)
- **TypeScript/JS:** camelCase (`nameFirst`, `scoreFinal`)
- **Category-first naming:** `name{Type}`, `score{Type}`, `date{Type}`, `url{Type}`
- **Brand name:** ObitNote (one word, capital O and N)
- **Text color:** #444444 everywhere (never black)
- **Two spaces** between sentences in user-facing text
- **Contractions** in UI text (we'll, don't) but NOT in legal pages

### Key Technical Decisions

1. **Source compliance:** Never scrape obituary pages, never deep-link, never show snippet text to users.  Only domain names visible.  Serper/Google data is scoring-only.
2. **Expo + React Native Web:** Enables future native apps from same codebase.  Primary target is web browsers today.
3. **No minification:** Expo web build uses `--no-minify` because minification breaks class name detection.  nginx gzip compensates.
4. **Fingerprint-based dedup:** Same obituary appears on 5+ syndication sites.  Fingerprint (`lastname-firstinitial-city-state-dod`) identifies the person across all sources.
5. **Keywords are boosters only:** Never filter results by keywords — they increase score but don't exclude non-matching results.

---

## 16. Legal & Compliance

### Source Data Compliance

ObitNote uses Serper.dev (Google search API) results for scoring and matching.  To comply with Google's Terms of Service and avoid litigation from obituary publishers:

- **Never** fetch or scrape obituary source pages directly
- **Never** deep-link to specific obituary URLs — only link to source domain homepages
- **Never** display raw snippet text to users — internal scoring use only
- `user_result.url` stores root domain only (e.g., `legacy.com`)
- API response is sanitized: no snippet, no image URL, no specific page URLs
- Search engine page enrichment is disabled globally

### User-Facing Legal Pages

- **Terms of Service:** /terms
- **Privacy Policy:** /privacy
- **Refund Policy:** /refund (cancel anytime, prorated refund, immediate)
- **Pricing:** /pricing

Users must consent to ToS and Privacy Policy during registration (checkbox).

### Trademark

- ObitNote™ displayed on prominent brand surfaces (header, sign-in, emails)
- Federal registration with USPTO recommended (~$250-350, Class 42)

---

## Appendix A: nginx Configuration Reference

```nginx
server {
    listen 443 ssl;
    server_name obitnote.com;

    ssl_certificate /etc/letsencrypt/live/obitnote.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/obitnote.com/privkey.pem;

    root /var/www/obitnote/client/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # No-cache for index.html (ensures new deploys load immediately)
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Long cache for hashed assets
    location /_expo/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API reverse proxy
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;
}

# www redirect
server {
    listen 443 ssl;
    server_name www.obitnote.com;
    ssl_certificate /etc/letsencrypt/live/obitnote.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/obitnote.com/privkey.pem;
    return 301 https://obitnote.com$request_uri;
}

# HTTP redirect
server {
    listen 80;
    server_name obitnote.com www.obitnote.com;
    return 301 https://obitnote.com$request_uri;
}
```

## Appendix B: PM2 Process Configuration

```bash
# Start processes
pm2 start /var/www/obitnote/search/src/api/server.js --name search
pm2 start /var/www/obitnote/api/dist/index.js --name api

# Save and enable startup
pm2 save
pm2 startup  # generates systemd service

# Common commands
pm2 status              # process health
pm2 logs api --lines 50 # recent API logs
pm2 logs search --lines 50
pm2 restart api --update-env  # restart with fresh .env
pm2 monit               # real-time CPU/memory
```

## Appendix C: Useful Diagnostic Commands

```bash
# Check services are running
pm2 status

# Check API health
curl http://localhost:3001/api/health

# Check search engine
curl "http://localhost:3000/health"

# Check database connectivity (from web server)
psql -h 10.0.0.2 -U onadmin dw -c "SELECT NOW()"

# Check today's batch
psql -h 10.0.0.2 -U onadmin dw -c "SELECT * FROM batch_log WHERE batch_date = CURRENT_DATE"

# Check today's backup
psql -h 10.0.0.2 -U onadmin dw -c "SELECT * FROM backup_log WHERE backup_date = CURRENT_DATE"

# Check recent fatal errors
psql -h 10.0.0.2 -U onadmin dw -c "SELECT * FROM fatal_error ORDER BY created_at DESC LIMIT 10"

# Check disk space
df -h

# Check SSL certificate expiry
sudo certbot certificates

# Check nginx status
sudo systemctl status nginx

# View nginx error log
sudo tail -50 /var/log/nginx/error.log

# Check PM2 memory/CPU
pm2 monit
```
