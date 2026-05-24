# Solidity Smart Audit

> AI-powered smart contract security analysis platform.  
> Submit a GitHub repo URL or a deployed EVM contract address — get a risk score, vulnerability report, and remediation checklist in seconds.

[![CI](https://github.com/baties/solidity-audit-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/baties/solidity-audit-assistant/actions/workflows/ci.yml)
[![Docker](https://github.com/baties/solidity-audit-assistant/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/baties/solidity-audit-assistant/actions/workflows/docker-publish.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## What It Does

Solidity Smart Audit helps Solidity developers, auditors, and DeFi teams catch vulnerabilities before they become exploits:

- **Submit** a GitHub repo URL or a verified contract address (Ethereum, Polygon, Arbitrum, Optimism, Base, BNB Chain)
- **Analyze** — 14 static pattern checks (12 SWC categories + gas analysis) and deep AI analysis covering proxy patterns, access control, arithmetic, and more
- **Receive** a 0–100 risk score, severity-ranked findings, and specific remediation recommendations
- **History** — sign in with GitHub to track past scans and share report links
- **Public API** — integrate scans into CI pipelines using API key authentication (`POST /v1/scan`)

---

## Prerequisites

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| Node.js | 20.x | 22.x also supported |
| pnpm | 9.x | `npm install -g pnpm@9` |
| Docker | 24.x | Required for full stack |
| Docker Compose | v2 | Bundled with Docker Desktop |

---

## Installation & Setup

### Before You Start — Port Conflict Check

If you have other Docker projects running, check which ports are already bound:

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

This project uses these host ports by default:

| Port | Used by | Override in `.env` |
|------|---------|---------------------|
| `80` | Nginx (web UI entry point) | `NGINX_HOST_PORT=8080` |
| `5432` | PostgreSQL | `POSTGRES_HOST_PORT=5433` |
| `3000` | Next.js | `APP_HOST_PORT_NEXT=3100` |
| `3001` | Express API | `APP_HOST_PORT_EXPRESS=3101` |

Only the *host-side* binding changes when you override a port — containers always communicate with each other on their internal ports, so the app pipeline is unaffected.

---

### Option A — Full Stack via Docker (Recommended)

Starts three containers: **nginx**, **app** (Next.js + Express), and **postgres**.

**Step 1 — Clone the repository**
```bash
git clone https://github.com/baties/solidity-audit-assistant.git
cd solidity-audit-assistant
```

**Step 2 — Configure environment**
```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```env
ANTHROPIC_API_KEY=sk-ant-...
ETHERSCAN_API_KEY=...
NEXTAUTH_SECRET=               # run: openssl rand -base64 32
NEXTAUTH_URL=http://localhost  # must match NGINX_HOST_PORT — see note below
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Use the Docker service name 'postgres' as the host — NOT localhost
DATABASE_URL=postgresql://solidityaudit:changeme_in_production@postgres:5432/solidityaudit
POSTGRES_PASSWORD=changeme_in_production

# Uncomment any port that conflicts with an existing project
# NGINX_HOST_PORT=8080        # also update NEXTAUTH_URL to http://localhost:8080
# POSTGRES_HOST_PORT=5433
# APP_HOST_PORT_NEXT=3100
# APP_HOST_PORT_EXPRESS=3101
```

> **Why `postgres` not `localhost` in DATABASE_URL?**
> Inside a Docker container `localhost` refers to the container itself, not your machine.
> The Postgres service runs in a separate container reachable by its service name `postgres`.

**Step 3 — Start the stack**
```bash
docker-compose -f docker/docker-compose.yml up -d
```

**Step 4 — Verify**
```bash
# Replace 80 with NGINX_HOST_PORT if you changed it
curl http://localhost/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

| URL | What |
|-----|------|
| `http://localhost` | Web UI |
| `http://localhost/api/health` | Health check |
| `http://localhost/api/docs` | OpenAPI 3.0 spec |

**To stop:**
```bash
docker-compose -f docker/docker-compose.yml down
```

**To stop and wipe the database volume (full reset):**
```bash
docker-compose -f docker/docker-compose.yml down -v
```

---

### Reusing Your Existing Postgres Docker Container

Use this when you already have a Postgres container running for another project and want to point this project at it instead of running a second database.

> **Simpler alternative:** set `POSTGRES_HOST_PORT=5433` in `.env` and let each project run its own isolated Postgres — no network wiring required. Only use the steps below if you specifically want to share one container.

**Step 1 — Find your existing Postgres container name**
```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
# Look for the postgres:XX image — note the container name in the first column
```

**Step 2 — Create the database and user inside that container**
```bash
docker exec -it <your_postgres_container> psql -U postgres
```
```sql
CREATE USER solidityaudit WITH PASSWORD 'choose_a_strong_password';
CREATE DATABASE solidityaudit OWNER solidityaudit;
GRANT ALL PRIVILEGES ON DATABASE solidityaudit TO solidityaudit;
\q
```

**Step 3 — Apply the schema to the new database**
```bash
docker exec -i <your_postgres_container> \
  psql -U solidityaudit -d solidityaudit < server/db/schema.sql
```

**Step 4 — Point `DATABASE_URL` at the existing container**

In `.env`, set the hostname to the container name (not `localhost` — `localhost` inside a Docker container refers to the container itself, not the host machine):
```env
DATABASE_URL=postgresql://solidityaudit:choose_a_strong_password@<your_postgres_container>:5432/solidityaudit
```

**Step 5 — Start the stack without the built-in postgres service**

The `--no-deps` flag tells Docker Compose to skip the `postgres` dependency declared in `depends_on`, so only `app` and `nginx` start:
```bash
docker-compose -f docker/docker-compose.yml up --no-deps app nginx -d
```

**Step 6 — Find the project network name**

Docker Compose names networks as `<project_name>_<network_name>`. The project name is derived from the directory. Find it:
```bash
docker network ls | grep solidityaudit
# Example: a1b2c3d4e5f6   soliditysecurityscannerservice_solidityaudit   bridge   local
```

**Step 7 — Connect your existing Postgres container to the project network**

This lets the `app` container reach your Postgres container by its name:
```bash
# Use the full network name from Step 6
docker network connect soliditysecurityscannerservice_solidityaudit <your_postgres_container>
```

**Step 8 — Verify**
```bash
curl http://localhost/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

The network connection in Step 7 persists until you explicitly disconnect it or remove the network. You do not need to repeat it on subsequent `docker-compose up` runs — the container stays connected.

---

### Option B — Local Development (Hot Reload)

Use this when actively developing — both Next.js and Express reload on file changes.

**Step 1 — Install dependencies**
```bash
pnpm install
```

**Step 2 — Choose a Postgres instance**

**Option 2A — Start this project's own Postgres container:**
```bash
# Starts just the postgres service — no app or nginx container
docker-compose -f docker/docker-compose.yml up postgres -d
```
If port 5432 is already taken by another running container, set `POSTGRES_HOST_PORT=5433` in `.env` first.

**Option 2B — Use your existing Postgres container (already running for another project):**

The dev server runs directly on your machine, so it reaches Docker containers through the port they expose to the host — `localhost` works here, unlike in Docker-to-Docker communication.

```bash
# Find the host port your existing Postgres container exposes
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep postgres
# Example output:  my_other_project_db   0.0.0.0:5432->5432/tcp
#                  The left-side port (5432 here) is reachable at localhost:5432
```

Follow Steps 1–3 of [Reusing Your Existing Postgres Docker Container](#reusing-your-existing-postgres-docker-container) to create the `solidityaudit` database and user. Skip the network wiring steps — those are only needed for Docker-to-Docker connections.

**Step 3 — Configure environment**
```bash
cp .env.example .env
```

For local dev, `DATABASE_URL` must use `localhost` — you are connecting from your machine, not from inside a container:
```env
# Use the host port your Postgres container exposes (5432 by default, or POSTGRES_HOST_PORT if changed)
DATABASE_URL=postgresql://solidityaudit:changeme_in_production@localhost:5432/solidityaudit
NEXTAUTH_URL=http://localhost:3000
```

**Step 4 — Run the development servers**
```bash
pnpm dev
```

This starts:
- **Next.js** on `http://localhost:3000`
- **Express API** on `http://localhost:3001`

In dev mode Next.js automatically proxies `/api/*` to Express, except for auth, scan, and history which are handled by Next.js Route Handlers.

---

### Option C — Pull Pre-built Docker Image

```bash
docker pull ghcr.io/baties/solidity-audit-assistant:latest
```

---

## VPS Deployment (Alongside an Existing Project)

For deploying on a VPS that already has another project running — including its own nginx and its own Postgres container.

### How It Works

You already have one nginx managing your VPS. This project's nginx container is **not started** — your existing nginx handles all routing directly. The two Postgres containers run completely isolated from each other; only the host port they expose differs.

```
Browser
    │  port 80 / 443
    ▼
Your VPS nginx (one nginx, handles all projects)
    │
    ├── server_name existingproject.com  →  your other project (unchanged)
    │
    └── server_name yourdomain.com
            │  /api/auth/*, /api/scan, /api/history, /api/api-keys, /  →  127.0.0.1:3000  (Next.js)
            │  /api/*, /v1/*                                            →  127.0.0.1:3001  (Express)
            ▼
        app container  (Next.js :3000 + Express :3001, exposed to host)
            │
            ▼
        postgres container  port 5433 on host → 5432 internally
        (fully isolated — no connection to the other project's Postgres)
```

---

### Step 1 — Check for port conflicts on the VPS

```bash
# See what host ports are already in use by running containers
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

For this project the ports that matter:

| Port | Used by | Likely conflict? | Fix |
|------|---------|-----------------|-----|
| `5432` | Postgres | Yes — other project probably uses this | Set `POSTGRES_HOST_PORT=5433` |
| `3000` | Next.js | Unlikely but check | Set `APP_HOST_PORT_NEXT=3100` |
| `3001` | Express | Unlikely but check | Set `APP_HOST_PORT_EXPRESS=3101` |
| `80` | nginx | Not started — not a concern | — |

---

### Step 2 — Clone the repository on the VPS

```bash
git clone https://github.com/baties/solidity-audit-assistant.git
cd solidity-audit-assistant
cp .env.example .env
```

---

### Step 3 — Set production values in `.env`

```env
NODE_ENV=production
LOG_LEVEL=info

# Required API keys
ANTHROPIC_API_KEY=sk-ant-...
ETHERSCAN_API_KEY=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
NEXTAUTH_SECRET=         # run: openssl rand -base64 32

# Set to your domain — switch to https:// after Step 6 (Certbot)
NEXTAUTH_URL=http://yourdomain.com
FRONTEND_URL=http://yourdomain.com

# Database — use the Docker service name 'postgres' as the host (not localhost)
DATABASE_URL=postgresql://solidityaudit:strong_db_password@postgres:5432/solidityaudit
POSTGRES_PASSWORD=strong_db_password

# Avoid port 5432 clash with the other project's Postgres container
POSTGRES_HOST_PORT=5433

# Only change these if docker ps shows something else already on 3000 or 3001
# APP_HOST_PORT_NEXT=3100
# APP_HOST_PORT_EXPRESS=3101
```

---

### Step 4 — Start only the app and postgres containers

The nginx container is skipped — your existing VPS nginx takes its place.

```bash
docker-compose -f docker/docker-compose.yml up app postgres -d
```

Verify the app is reachable on the host before touching nginx:

```bash
curl http://localhost:3000
# Should return HTML (Next.js page)

curl http://localhost:3001/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

> If you changed `APP_HOST_PORT_NEXT` or `APP_HOST_PORT_EXPRESS`, use those ports in the curl commands above.

---

### Step 5 — Add a server block to your existing VPS nginx

This block replicates the routing that the project's built-in nginx would normally do — routing auth and session-aware endpoints to Next.js, and the raw API to Express.

Create `/etc/nginx/sites-available/solidity-audit`:

```bash
sudo nano /etc/nginx/sites-available/solidity-audit
```

Paste the following — **replace `yourdomain.com`** and adjust the port numbers if you changed `APP_HOST_PORT_NEXT` or `APP_HOST_PORT_EXPRESS`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    client_max_body_size 10m;

    # GitHub OAuth and NextAuth session routes — must go to Next.js
    location /api/auth/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # Scan submission — Next.js Route Handler injects userId from session
    location = /api/scan {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # User scan history — session-protected
    location = /api/history {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # API key management — session-protected
    location /api/api-keys {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # Express API — health check, raw scan result lookup
    location /api/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Public REST API — authenticated by X-Api-Key header
    location /v1/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Next.js frontend — all other routes including _next/static assets
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/solidity-audit /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

### Step 6 — Add SSL with Certbot

```bash
sudo certbot --nginx -d yourdomain.com
```

After Certbot finishes, update `.env` to use `https://` and restart the app container:

```env
NEXTAUTH_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

```bash
docker-compose -f docker/docker-compose.yml restart app
```

---

### Step 7 — Update your GitHub OAuth App

Go to [github.com/settings/developers](https://github.com/settings/developers) and update:

- **Homepage URL**: `https://yourdomain.com`
- **Authorization callback URL**: `https://yourdomain.com/api/auth/callback/github`

---

### Step 8 — Confirm auto-restart on reboot

```bash
sudo systemctl enable docker
```

`restart: unless-stopped` in docker-compose ensures all containers come back up automatically after a VPS reboot.

---

### Applying Database Migrations on the VPS

The schema is applied automatically on the Postgres container's first boot. For subsequent migration files after a project update:

```bash
for f in server/db/migrations/*.sql; do
  docker exec -i \
    "$(docker-compose -f docker/docker-compose.yml ps -q postgres)" \
    psql -U solidityaudit -d solidityaudit < "$f"
done
```

---

## GitHub OAuth Setup

Required for sign-in and scan history features.

1. Go to [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**
2. Set **Homepage URL**: `http://localhost` (or your production domain)
3. Set **Authorization callback URL**: `http://localhost/api/auth/callback/github`
   - If you changed `NGINX_HOST_PORT`, replace `localhost` with `localhost:8080` (or whichever port you set)
   - On VPS with a real domain: use `https://yourdomain.com/api/auth/callback/github`
4. Copy the **Client ID** and **Client Secret** into your `.env`:
   ```
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   NEXTAUTH_SECRET=$(openssl rand -base64 32)
   NEXTAUTH_URL=http://localhost   # must match the URL nginx is reachable at
   ```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | Claude API key for AI security analysis |
| `ETHERSCAN_API_KEY` | ✅ | Contract source fetching (fallback for all chains) |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | ✅ | Random secret — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | Public URL of the app (e.g. `http://localhost`) |
| `GITHUB_CLIENT_ID` | ✅ | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | ✅ | GitHub OAuth App client secret |
| `GITHUB_TOKEN` | Optional | GitHub PAT — raises rate limit from 60 → 5000 req/hr |
| `POLYGONSCAN_API_KEY` | Optional | Dedicated Polygon Etherscan key |
| `ARBISCAN_API_KEY` | Optional | Dedicated Arbitrum key |
| `OPTIMISM_ETHERSCAN_API_KEY` | Optional | Dedicated Optimism key |
| `BASESCAN_API_KEY` | Optional | Dedicated Base key |
| `BSCSCAN_API_KEY` | Optional | Dedicated BNB Chain key |
| `INTERNAL_API_URL` | Optional | Express URL seen by Next.js (default: `http://localhost:3001`) |
| `LOG_LEVEL` | Optional | `debug` (dev) or `info` (prod), default: `info` |
| `NGINX_HOST_PORT` | Optional | Host port nginx binds to (default: `80`) — set to e.g. `8080` if port 80 is taken |
| `POSTGRES_HOST_PORT` | Optional | Host port Postgres binds to (default: `5432`) — set to e.g. `5433` if taken |
| `APP_HOST_PORT_NEXT` | Optional | Host port for Next.js (default: `3000`) |
| `APP_HOST_PORT_EXPRESS` | Optional | Host port for Express API (default: `3001`) |

See `.env.example` for all variables with descriptions.

---

## Running Tests

```bash
# Run the full test suite
pnpm test

# Watch mode (re-runs on file save)
pnpm test:watch

# Run a specific test file
pnpm test server/__tests__/api-keys.test.ts
```

Tests use **Vitest** and **Supertest**. All database calls and the AI pipeline are mocked — no running Postgres or Anthropic API key is required to run tests.

**Current test coverage:**

| Suite | Tests | What it covers |
|-------|-------|----------------|
| `health.test.ts` | 2 | GET /api/health, 404 handler |
| `scan-validation.test.ts` | 8 | Zod input validation on POST /api/scan |
| `analyzer.test.ts` | 22 | All 14 static SWC + gas checks |
| `api-keys.test.ts` | 13 | API key CRUD, /v1/scan auth, /api/docs |
| **Total** | **45** | |

---

## Type Checking & Linting

```bash
# TypeScript strict check (must pass before every commit)
pnpm typecheck

# ESLint (zero warnings allowed)
pnpm lint

# Run all checks in sequence
pnpm typecheck && pnpm lint && pnpm test
```

---

## Public REST API

For CI/CD integrations and programmatic access.

**Step 1 — Sign in** at `http://localhost` with GitHub OAuth.

**Step 2 — Create an API key** via the web UI (Settings → API Keys) or directly:
```bash
curl -X POST http://localhost/api/api-keys \
  -H "Cookie: <your-session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My CI key"}'
```
The response includes the plaintext key (`ska_...`) **once** — save it immediately.

**Step 3 — Scan a contract or repo**
```bash
# Scan a GitHub repository
curl -X POST http://localhost/v1/scan \
  -H "X-Api-Key: ska_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"target": "https://github.com/OpenZeppelin/openzeppelin-contracts", "targetType": "github"}'

# Scan a deployed contract
curl -X POST http://localhost/v1/scan \
  -H "X-Api-Key: ska_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"target": "0xdAC17F958D2ee523a2206206994597C13D831ec7", "targetType": "address", "chain": "ethereum"}'
```

**Rate limit:** 1 request per 30 seconds per API key.

Full API reference: `GET /api/docs` (OpenAPI 3.0.3 YAML).

---

## Architecture

```
Browser / API Client
  │
  ▼
Nginx :80
  ├── /api/auth/*     ──► Next.js :3000  (GitHub OAuth — NextAuth.js v5)
  ├── /api/scan       ──► Next.js :3000  (injects userId from session → Express)
  ├── /api/history    ──► Next.js :3000  (session-protected scan history)
  ├── /api/api-keys   ──► Next.js :3000  (session-protected key management)
  ├── /v1/*           ──► Express :3001  (public REST API — X-Api-Key auth)
  ├── /api/*          ──► Express :3001  (health, scan result lookup)
  │                            │
  │                   ┌────────▼──────────────────┐
  │                   │  Scan Pipeline             │
  │                   │  orchestrator.ts           │
  │                   │    ├── fetcher.ts          │  ◄── GitHub (Octokit REST)
  │                   │    │                       │  ◄── Etherscan / Sourcify
  │                   │    ├── analyzer.ts         │  (14 static checks)
  │                   │    └── llm.ts              │  ◄── Claude AI (tool_use)
  │                   └────────────────────────────┘
  │                            │
  │                   PostgreSQL :5432
  │                   (scans · findings · users · api_keys)
  │
  └── /*              ──► Next.js :3000  (web UI)
```

**Key architectural decisions:**
- **Raw SQL** over ORM — explicit migrations, full control ([ADR-001](docs/adr/001-raw-sql.md))
- **Structured `tool_use`** over free-form LLM output — typed results, no regex parsing ([ADR-002](docs/adr/002-tool-use.md))
- **Two-layer proxy detection** — source pattern + on-chain EIP-1967 slot read ([ADR-003](docs/adr/003-proxy-detection.md))
- **Next.js standalone output** — Docker runner stage is self-contained, no `node_modules` copy needed
- **Synchronous scans** — HTTP request blocks until complete (~10–60 s); simpler than async polling for current scale

---

## Supported Vulnerability Categories

| Category | SWC ID | Detection |
|----------|--------|-----------|
| Reentrancy | SWC-107 | Static + AI |
| Authorization via tx.origin | SWC-115 | Static + AI |
| Unchecked low-level calls | SWC-104 | Static + AI |
| Integer overflow / underflow (pre-0.8) | SWC-101 | Static + AI |
| Unprotected selfdestruct | SWC-106 | Static + AI |
| Unprotected suicide | SWC-105 | Static + AI |
| Block values as time source | SWC-116 | Static + AI |
| Weak randomness | SWC-120 | Static + AI |
| Outdated compiler | SWC-102 | Static + AI |
| Unchecked return values | SWC-114 | Static + AI |
| DoS via unbounded operations | SWC-113 | Static + AI |
| Uninitialized storage pointer | SWC-109 | Static + AI |
| Gas: array.length in loop | — | Static |
| Gas: storage writes in loop | — | Static |
| Proxy pattern detection | EIP-1967, EIP-1167 | Static + on-chain |

---

## Project Status

All development phases complete. See [ROADMAP.md](ROADMAP.md) for full history.

| Phase | Goal | Status |
|-------|------|--------|
| 0 — Scaffold | Repo structure, Docker, DB schema, stubs | ✅ Done |
| 1 — MVP | End-to-end scan pipeline | ✅ Done |
| 2 — Depth | 14 checks, multi-chain, proxy detection | ✅ Done |
| 3 — Auth & History | GitHub OAuth, scan history | ✅ Done |
| 4 — Production | Rate limiting, public API, CI/CD, Docker image | ✅ Done |

---

## CI / CD

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | Push / PR to `main` | typecheck → lint → test (45 tests) |
| `docker-publish.yml` | Push to `main` | Builds and pushes `ghcr.io/baties/solidity-audit-assistant:latest` |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, branch naming, PR checklist, and code standards.

---

## Security

Report vulnerabilities via GitHub's private advisory system — see [SECURITY.md](SECURITY.md).

---

## License

MIT — contributions welcome via PR against `main`.
