# SolidityGuard AI

> AI-powered smart contract security analysis platform.
> Accepts a GitHub repo URL or deployed EVM contract address — returns a risk score, vulnerability report, and remediation checklist.

---

## What It Does

SolidityGuard AI helps Solidity developers, auditors, and DeFi teams catch vulnerabilities before they become exploits:

- **Submit** a GitHub repo URL or a verified contract address (Ethereum, Polygon, Arbitrum, Optimism, Base, BSC)
- **Analyze** — static pattern checks + deep Claude AI analysis covering 12+ vulnerability categories
- **Receive** a 0–100 risk score, severity-ranked findings, and specific remediation recommendations

---

## Quick Start (Docker)

```bash
# 1. Clone
git clone https://github.com/your-org/solidityguard.git
cd solidityguard

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set: ANTHROPIC_API_KEY, ETHERSCAN_API_KEY

# 3. Start the full stack
docker-compose up

# App:      http://localhost (via Nginx)
# API:      http://localhost/api/health
# Postgres: localhost:5432
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | Claude API key — get from [console.anthropic.com](https://console.anthropic.com) |
| `ETHERSCAN_API_KEY` | ✅ | Etherscan API key for contract source fetching |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `GITHUB_TOKEN` | Optional | GitHub PAT — increases rate limit from 60 → 5000 req/hr |
| `PORT` | Optional | Express API port (default: `3001`) |
| `LOG_LEVEL` | Optional | `debug` (dev) or `info` (prod), default: `info` |
| `NEXTAUTH_SECRET` | Phase 3 | Required when auth is enabled |
| `GITHUB_CLIENT_ID` | Phase 3 | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Phase 3 | GitHub OAuth App client secret |

See `.env.example` for the full list with descriptions.

---

## Architecture

```
Browser
  │
  ▼
Nginx :80
  ├── /api/* ──► Express API :3001
  │                  │
  │              ┌───▼────────────────────┐
  │              │  Scan Pipeline         │
  │              │  orchestrator.ts       │
  │              │    ├── fetcher.ts      │  ◄── GitHub (Octokit)
  │              │    │                   │  ◄── Etherscan / Sourcify
  │              │    ├── analyzer.ts     │  (static checks)
  │              │    └── llm.ts          │  ◄── Claude claude-sonnet-4-20250514
  │              └────────────────────────┘
  │                  │
  │              PostgreSQL :5432
  │
  └── /* ──────► Next.js :3000
```

**Key decisions:**
- **Raw SQL** over ORM — explicit migrations, easier audit trail ([ADR-001](docs/adr/001-raw-sql.md))
- **Claude `tool_use`** over free-form output — type-safe structured results, no regex parsing ([ADR-002](docs/adr/002-tool-use.md))
- **Express + Next.js** coexist — Next.js rewrites `/api/*` to Express in dev; Nginx routes in prod

---

## Development

```bash
# Install dependencies
pnpm install

# Start dev servers (Next.js :3000 + Express :3001)
pnpm dev

# Type check
pnpm typecheck

# Lint
pnpm lint

# Test
pnpm test
```

Requires: Node.js 20+, pnpm 8+, PostgreSQL 16 (or use Docker).

---

## Project Status

See [ROADMAP.md](ROADMAP.md) for current phase and upcoming work.

| Phase | Status |
|-------|--------|
| 0 — Scaffold | 🔄 In Progress |
| 1 — MVP | ⬜ Next |
| 2 — Depth | ⬜ Planned |
| 3 — Auth & History | ⬜ Planned |
| 4 — Production | ⬜ Planned |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for repo setup, branch naming, PR checklist, and code standards.

---

## License

MIT — contributions welcome via PR against `main`.
