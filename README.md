# Solidity Smart Audit

> AI-powered smart contract security analysis platform.  
> Submit a GitHub repo URL or a deployed EVM contract address — get a risk score, vulnerability report, and remediation checklist in seconds.

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## What It Does

Solidity Smart Audit helps Solidity developers, auditors, and DeFi teams catch vulnerabilities before they become exploits:

- **Submit** a GitHub repo URL or a verified contract address (Ethereum, Polygon, Arbitrum, Optimism, Base, BNB Chain)
- **Analyze** — 14 static pattern checks (12 SWC categories + gas analysis) and deep AI analysis covering proxy patterns, access control, arithmetic, and more
- **Receive** a 0–100 risk score, severity-ranked findings, and specific remediation recommendations
- **History** — sign in with GitHub to track your past scans and share report links

---

## Quick Start (Docker)

```bash
# 1. Clone
git clone https://github.com/batis/solidity-audit-assistant.git
cd solidity-audit-assistant

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set:
#   ANTHROPIC_API_KEY, ETHERSCAN_API_KEY,
#   NEXTAUTH_SECRET, NEXTAUTH_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

# 3. Start the full stack
docker-compose -f docker/docker-compose.yml up

# App:      http://localhost (via Nginx)
# API:      http://localhost/api/health
# Postgres: localhost:5432
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | AI analysis API key (used by the scan pipeline) |
| `ETHERSCAN_API_KEY` | ✅ | Contract source fetching (fallback for all chains) |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | ✅ | Random secret — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | Public URL of the Next.js app |
| `GITHUB_CLIENT_ID` | ✅ | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | ✅ | GitHub OAuth App client secret |
| `GITHUB_TOKEN` | Optional | GitHub PAT — raises rate limit from 60 → 5000 req/hr |
| `POLYGONSCAN_API_KEY` | Optional | Dedicated Polygon key |
| `ARBISCAN_API_KEY` | Optional | Dedicated Arbitrum key |
| `OPTIMISM_ETHERSCAN_API_KEY` | Optional | Dedicated Optimism key |
| `BASESCAN_API_KEY` | Optional | Dedicated Base key |
| `BSCSCAN_API_KEY` | Optional | Dedicated BNB Chain key |
| `LOG_LEVEL` | Optional | `debug` (dev) or `info` (prod), default: `info` |

See `.env.example` for the full list with descriptions.

---

## Architecture

```
Browser
  │
  ▼
Nginx :80
  ├── /api/auth/*  ──► Next.js :3000  (GitHub OAuth)
  ├── /api/scan    ──► Next.js :3000  (injects userId, proxies to Express)
  ├── /api/history ──► Next.js :3000  (session-protected scan history)
  ├── /api/*       ──► Express :3001
  │                        │
  │                   ┌────▼───────────────────┐
  │                   │  Scan Pipeline          │
  │                   │  orchestrator.ts        │
  │                   │    ├── fetcher.ts       │  ◄── GitHub (Octokit)
  │                   │    │                    │  ◄── Etherscan / Sourcify
  │                   │    ├── analyzer.ts      │  (14 static checks)
  │                   │    └── llm.ts           │  ◄── AI analysis
  │                   └─────────────────────────┘
  │                        │
  │                   PostgreSQL :5432
  │                   (scans, findings, users)
  │
  └── /* ──────────► Next.js :3000
```

**Key architectural decisions:**
- **Raw SQL** over ORM — explicit migrations, full control, no magic ([ADR-001](docs/adr/001-raw-sql.md))
- **Structured tool output** over free-form text — typed results, no fragile regex parsing ([ADR-002](docs/adr/002-tool-use.md))
- **Two-layer proxy detection** — source-pattern detection + on-chain EIP-1967 slot read ([ADR-003](docs/adr/003-proxy-detection.md))
- **Express + Next.js coexistence** — Next.js rewrites `/api/*` to Express in dev; Nginx routes in prod

---

## Development

```bash
# Prerequisites: Node.js 20+, pnpm 8+, Docker

pnpm install          # install all dependencies
pnpm dev              # Next.js :3000 + Express :3001 (requires local Postgres)
pnpm typecheck        # tsc --noEmit — must pass before any commit
pnpm lint             # ESLint
pnpm test             # Vitest
docker-compose -f docker/docker-compose.yml up  # full stack
```

**Local Postgres shortcut** (if not running the full Docker stack):
```bash
docker-compose -f docker/docker-compose.yml up postgres -d
pnpm dev
```

---

## GitHub OAuth Setup

1. Go to [github.com/settings/developers](https://github.com/settings/developers) → New OAuth App
2. Set **Homepage URL**: `http://localhost:3000` (or your domain)
3. Set **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Copy the Client ID and Secret into your `.env`

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

See [ROADMAP.md](ROADMAP.md) for current phase and upcoming work.

| Phase | Status |
|-------|--------|
| 0 — Scaffold | ✅ Done |
| 1 — MVP | ✅ Done |
| 2 — Depth | ✅ Done |
| 3 — Auth & History | ✅ Done |
| 4 — Production | ⬜ Planned |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, branch naming, PR checklist, and code standards.

---

## License

MIT — contributions welcome via PR against `main`.
