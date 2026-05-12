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

### Option A — Full Stack via Docker (Recommended)

The fastest way to run the complete application locally.

**Step 1 — Clone the repository**
```bash
git clone https://github.com/baties/solidity-audit-assistant.git
cd solidity-audit-assistant
```

**Step 2 — Configure environment**
```bash
cp .env.example .env
```

Open `.env` and fill in the required values (see [Environment Variables](#environment-variables) below).  
At minimum you need: `ANTHROPIC_API_KEY`, `ETHERSCAN_API_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `DATABASE_URL`.

**Step 3 — Start the full stack**
```bash
docker-compose -f docker/docker-compose.yml up
```

This starts three containers: **app** (Next.js + Express), **postgres**, and **nginx**.

| Service | URL |
|---------|-----|
| Web UI | http://localhost |
| API health | http://localhost/api/health |
| OpenAPI spec | http://localhost/api/docs |
| Postgres | localhost:5432 |

**Step 4 — Verify it's running**
```bash
curl http://localhost/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

To run in the background (VPS / server mode):
```bash
docker-compose -f docker/docker-compose.yml up -d
```

To stop:
```bash
docker-compose -f docker/docker-compose.yml down
```

---

### Option B — Local Development (Hot Reload)

Use this when actively developing — both Next.js and Express reload on file changes.

**Step 1 — Install dependencies**
```bash
pnpm install
```

**Step 2 — Start a local Postgres instance**
```bash
# Uses the docker-compose postgres service only — no app container
docker-compose -f docker/docker-compose.yml up postgres -d
```

**Step 3 — Configure environment**
```bash
cp .env.example .env
# Edit .env — set DATABASE_URL to point to the local postgres:
# DATABASE_URL=postgresql://solidityaudit:changeme_in_production@localhost:5432/solidityaudit
```

**Step 4 — Run the development servers**
```bash
pnpm dev
```

This starts:
- **Next.js** on `http://localhost:3000`
- **Express API** on `http://localhost:3001`

In dev mode, Next.js automatically proxies `/api/*` calls to Express (except auth, scan, and history which are handled by Next.js Route Handlers).

---

### Option C — Pull Pre-built Docker Image

```bash
docker pull ghcr.io/baties/solidity-audit-assistant:latest
```

---

## GitHub OAuth Setup

Required for sign-in and scan history features.

1. Go to [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**
2. Set **Homepage URL**: `http://localhost` (or your production domain)
3. Set **Authorization callback URL**: `http://localhost/api/auth/callback/github`
4. Copy the **Client ID** and **Client Secret** into your `.env`:
   ```
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   NEXTAUTH_SECRET=$(openssl rand -base64 32)
   NEXTAUTH_URL=http://localhost
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
