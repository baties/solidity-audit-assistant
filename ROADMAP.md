# Solidity Smart Audit — Roadmap

> Single source of truth for project phase, progress, and next steps.  
> Updated at the end of every development cycle.

---

## Current Phase: 4 — Production ⬜ Next

**Goal**: Rate limiting, public REST API, Docker Hub image, full documentation

---

## Phase Status

| Phase | Goal | Status |
|-------|------|--------|
| **0 — Scaffold** | Repo structure, Docker infra, DB schema, empty route stubs, README skeleton | ✅ Done |
| **1 — MVP** | Scan input → GitHub/Etherscan fetcher → 5 static checks → AI analysis → risk score → report UI | ✅ Done |
| **2 — Depth** | All 12 SWC categories, gas analysis, multi-chain, proxy detection | ✅ Done |
| **3 — Auth & History** | GitHub OAuth, scan history per user, shareable report links | ✅ Done |
| **4 — Production** | Rate limiting, public REST API, Docker Hub image, full docs | ⬜ Planned |

---

## Phase 0 — Scaffold ✅ Done

Full project structure in place: Next.js App Router, Express API, PostgreSQL schema, Docker Compose, Nginx, and all stubs.

**Key files:**
- `types/index.ts`, `server/lib/logger.ts`
- `server/db/schema.sql` + `server/db/migrations/001_initial.sql`
- `server/api/` (health, scan, scanResult stubs), `server/agents/` (stubs)
- `app/layout.tsx`, `app/page.tsx`, `app/scan/[scanId]/page.tsx`
- `components/ScanForm.tsx`, `ReportCard.tsx`, `RiskBadge.tsx`
- `lib/schemas.ts`, `lib/constants.ts`
- `docker/Dockerfile.app`, `docker/docker-compose.yml`, `docker/nginx.conf`
- `.env.example`, `README.md`, `CONTRIBUTING.md`, `docs/adr/001-raw-sql.md`, `docs/adr/002-tool-use.md`

---

## Phase 1 — MVP ✅ Done

Full scan pipeline, end-to-end.

**What was built:**
- `server/services/etherscan.ts` — handles all 3 Etherscan source formats; Sourcify fallback; chain-aware endpoints
- `server/services/github.ts` — Octokit REST; parses GitHub URL; recursive tree; fetches `.sol` blobs (capped at 50 files)
- `server/agents/fetcher.ts` — routes to GitHub or Etherscan by `targetType`
- `server/agents/analyzer.ts` — 5 SWC pattern checks: reentrancy, tx.origin, unchecked `.send()`, pre-0.8 overflow, selfdestruct
- `server/agents/llm.ts` — structured AI analysis; forced tool output; 80 KB source truncation
- `server/agents/orchestrator.ts` — fetch → analyze → AI → ScanResult with per-stage timing
- `server/db/queries.ts` — `createScan`, `updateScanStatus`, `completeScan`, `failScan`, `insertFindings`, `getScanById`
- `server/api/scan.ts` — Zod → create DB record → pipeline → persist → respond
- `components/FindingItem.tsx`, `components/ReportCard.tsx` — report UI
- `app/scan/[scanId]/page.tsx` — server component fetching scan result

**18 tests passing, tsc clean.**

---

## Phase 2 — Depth ✅ Done

**What was built:**
- `server/agents/analyzer.ts` — 14 checks: 12 SWC + 2 gas patterns; `scope: 'file'` for multi-line checks
- `server/services/etherscan.ts` — per-chain API key resolution (Polygon, Arbitrum, Optimism, Base, BNB Chain)
- `server/services/etherscan.ts` — `fetchImplementationIfProxy()`: reads EIP-1967 storage slot via `eth_getStorageAt`
- `server/services/proxy.ts` — new service: detects EIP-1967 transparent/UUPS and EIP-1167 minimal clone patterns in source
- `server/agents/fetcher.ts` — proxy detection integrated: fetches implementation source and merges with `__proxy_info__.txt` header
- `server/agents/prompts/system.ts` — updated with gas analysis and proxy audit instructions
- `docs/adr/003-proxy-detection.md` — ADR documenting the two-layer proxy detection approach
- `.env.example` — all per-chain API key vars documented

**32 tests passing, tsc clean.**

---

## Phase 3 — Auth & History ✅ Done

**What was built:**
- `next-auth@5.0.0-beta.30` installed — JWT strategy, GitHub OAuth provider
- `auth.ts` — NextAuth config: `signIn` callback upserts user to DB; JWT + session callbacks carry `githubId`
- `app/api/auth/[...nextauth]/route.ts` — OAuth catch-all Route Handler
- `app/api/scan/route.ts` — Next.js Route Handler wrapping Express scan; injects `X-User-Id` from session
- `app/api/history/route.ts` — session-protected history endpoint
- `server/api/scanHistory.ts` — Express handler for `GET /api/scan-history/:userId`
- `server/db/migrations/002_users.sql` — `users` table + `user_id` FK on scans
- `server/db/queries.ts` — `upsertUser`, `getUserByGithubId`, `getScansByUser`, `assignScanToUser`
- `types/next-auth.d.ts` — module augmentation adding `githubId` to `Session.user`
- `components/AuthButton.tsx` — server component: avatar + History link + sign-out when authenticated
- `app/layout.tsx` — `AuthButton` in header nav; logo links to `/`
- `app/history/page.tsx` — scan history page with `RiskBadge` cards; redirects unauthenticated users
- `docker/nginx.conf` — routing updated: auth/scan/history → Next.js; remaining `/api/*` → Express

**32 tests passing, tsc clean.**

---

## Phase 4 — Production ⬜ Planned

**Goal**: Make the project ready for self-hosted production deployments and public API consumers.

**Planned items:**
- [ ] Rate limiting on POST `/api/scan` (1 scan per user per 30 s; per-IP for unauthenticated users)
- [ ] Public REST API with API key authentication and OpenAPI spec
- [ ] Docker Hub image (`ghcr.io/batis/solidity-audit-assistant`)
- [ ] Full API reference docs in `docs/api/`
- [ ] `SECURITY.md` and responsible disclosure process
- [ ] End-to-end tests (Playwright or Supertest for full pipeline)
- [ ] GitHub Actions CI — typecheck + lint + test on every PR

---

## Architecture Decisions

| Decision | ADR |
|----------|-----|
| Raw SQL over ORM | [docs/adr/001-raw-sql.md](docs/adr/001-raw-sql.md) |
| Structured tool output over free-form LLM | [docs/adr/002-tool-use.md](docs/adr/002-tool-use.md) |
| Two-layer proxy detection | [docs/adr/003-proxy-detection.md](docs/adr/003-proxy-detection.md) |

**Other recorded decisions:**
- Next.js config must be `.mjs` (Next.js 14 does not support TypeScript config files)
- DB pool is lazy — created on first `query()` call, not at module load (required for tests)
- Scans run synchronously — HTTP request blocks until complete (~60 s max)
- Nginx routes `/api/auth/*`, `/api/scan`, `/api/history` → Next.js; other `/api/*` → Express

---

*Last updated: 2026-04-05 — Phase 3 complete. Auth & history implemented. 32 tests passing, tsc clean. Phase 4 ready to begin.*
