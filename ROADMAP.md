# SolidityGuard AI — Roadmap

> Single source of truth for project phase, progress, and next steps.
> Updated by Architect at the end of every agent run.

---

## Current Phase: 3 — Auth & History ⬜ Next

**Goal**: All 12 vuln categories, gas analysis, multi-chain, proxy detection

---

## Phase Status

| Phase | Goal | Status |
|-------|------|--------|
| **0 — Scaffold** | Repo structure, docker-compose, DB schema, empty route stubs, README skeleton | ✅ Done |
| **1 — MVP** | Scan input → GitHub/Etherscan fetcher → 5 static checks → Claude analysis → risk score → report UI | ✅ Done |
| **2 — Depth** | All 12 vuln categories, gas analysis, multi-chain, proxy detection | ✅ Done |
| **3 — Auth & History** | NextAuth GitHub OAuth, scan history, shareable report links | ⬜ Planned |
| **4 — Production** | Rate limiting, public REST API, Docker Hub image, full docs | ⬜ Planned |

---

## Phase 0 — Scaffold ✅ Done

All files created. Full project structure in place.

**Key files created:**
- Root: `package.json`, `tsconfig.json`, `tsconfig.server.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.js`, `vitest.config.ts`
- `types/index.ts` — shared interfaces
- `server/lib/logger.ts` — pino logger
- `server/db/schema.sql` + `server/db/migrations/001_initial.sql`
- `server/db/client.ts` — lazy pg Pool
- `server/api/health.ts`, `scan.ts`, `scanResult.ts`, `index.ts`
- `server/services/etherscan.ts`, `github.ts` (stubs at this stage)
- `server/agents/orchestrator.ts`, `fetcher.ts`, `analyzer.ts`, `llm.ts`, `prompts/system.ts` (stubs)
- `server/index.ts`
- `app/layout.tsx`, `page.tsx`, `globals.css`, `scan/[scanId]/page.tsx`
- `components/ScanForm.tsx`, `ReportCard.tsx`, `RiskBadge.tsx`
- `lib/schemas.ts`, `lib/constants.ts`
- `docker/Dockerfile.app`, `docker/docker-compose.yml`, `docker/nginx.conf`
- `.env.example`, `.dockerignore`
- `ROADMAP.md`, `README.md`, `CONTRIBUTING.md`, `docs/adr/001-raw-sql.md`, `docs/adr/002-tool-use.md`

---

## Phase 1 — MVP ✅ Done

Full scan pipeline implemented end-to-end.

**What was built:**
- `server/services/etherscan.ts` — full implementation: handles all 3 Etherscan source formats (plain, `{{}}` Standard JSON, regular JSON); Sourcify fallback; chain-aware endpoints
- `server/services/github.ts` — Octokit REST; parses GitHub URL; recursive tree; fetches .sol blobs; capped at 50 files
- `server/agents/fetcher.ts` — routes to github or etherscan service by targetType
- `server/agents/analyzer.ts` — 5 SWC pattern checks: reentrancy (SWC-107), tx.origin (SWC-115), unchecked .send() (SWC-104), pre-0.8 overflow (SWC-101), selfdestruct (SWC-106)
- `server/agents/llm.ts` — real Claude `claude-sonnet-4-20250514` call; forced tool_use; 80KB source truncation; maps tool output to `VulnerabilityFinding[]`
- `server/agents/orchestrator.ts` — wired pipeline: fetch → analyze → llm → ScanResult; per-stage timing
- `server/db/queries.ts` — all DB helpers: createScan, updateScanStatus, completeScan, failScan, insertFindings, getScanById
- `server/api/scan.ts` — full implementation: Zod → create DB record → pipeline → persist → respond (synchronous for MVP)
- `server/api/scanResult.ts` — GET /api/scan/:scanId
- `components/FindingItem.tsx` — expandable finding card with severity colors
- `components/ReportCard.tsx` — full report: badge, summary, severity grid, findings list
- `app/scan/[scanId]/page.tsx` — server component fetching scan from internal API

**Tests written (18 passing):**
- `server/__tests__/health.test.ts` — health endpoint (no DB needed)
- `server/__tests__/scan-validation.test.ts` — Zod validation (DB mocked)
- `server/agents/__tests__/analyzer.test.ts` — all 5 SWC checks with known Solidity snippets

**Bugs fixed during Phase 1:**
- `next.config.ts` → `next.config.mjs` (Next.js 14 does not support .ts config)
- `server/db/client.ts` — Pool made lazy (was throwing at import time, broke all tests)
- `tsconfig.server.json` — added `"dom"` to lib for `fetch` type availability

**Known infrastructure requirement:**
- `pnpm dev` requires a running Postgres. Start with: `docker-compose -f docker/docker-compose.yml up postgres -d`
- Or full stack: `docker-compose -f docker/docker-compose.yml up --build`

---

## Phase 2 — Depth ✅ Done

**Goal**: Expand from 5 static checks to all 12 SWC categories, add gas analysis, multi-chain Etherscan keys, proxy detection (EIP-1967, minimal proxy).

**What was built:**
- `server/agents/analyzer.ts` — 14 checks total: 12 SWC (107, 115, 104, 101, 106, 105, 116, 120, 114, 113, 109, 127) + 2 gas (array.length in loop, storage push in loop)
- `server/agents/analyzer.ts` — `scope: 'file'` support for multi-line pattern checks (used by SWC-105, 114, gas-002)
- `server/services/etherscan.ts` — per-chain API key resolution: POLYGONSCAN_API_KEY, ARBISCAN_API_KEY, OPTIMISM_ETHERSCAN_API_KEY, BASESCAN_API_KEY, BSCSCAN_API_KEY; falls back to ETHERSCAN_API_KEY
- `server/services/etherscan.ts` — `fetchImplementationIfProxy()`: reads EIP-1967 storage slot via Etherscan `eth_getStorageAt`
- `server/services/proxy.ts` — new service: `detectProxyFromSource()` — detects EIP-1967 transparent/UUPS and EIP-1167 minimal clone patterns in source text
- `server/agents/fetcher.ts` — proxy detection integrated: detects proxy → reads EIP-1967 slot → fetches implementation source → merges with `implementation(<addr>)/` prefix + `__proxy_info__.txt` header
- `server/agents/prompts/system.ts` — updated with gas analysis instructions, proxy contract audit instructions, `__proxy_info__.txt` protocol
- `server/agents/__tests__/analyzer.test.ts` — 32 tests total (22 analyzer + 8 scan-validation + 2 health), all passing
- `docs/adr/003-proxy-detection.md` — ADR documenting two-layer proxy detection approach
- `.env.example` — all per-chain API key vars documented

---

## Phase 3 — Auth & History ⬜ Planned

NextAuth.js v5 GitHub OAuth, scan history per user, shareable report links.

---

## Phase 4 — Production ⬜ Planned

Rate limiting, public REST API, Docker Hub image, full docs.

---

## Decisions & ADRs

- **Raw SQL over ORM** → `docs/adr/001-raw-sql.md`
- **tool_use over free-form LLM output** → `docs/adr/002-tool-use.md`
- **Express + Next.js coexistence**: Next.js rewrites `/api/*` to Express :3001 in dev; Nginx routes in prod
- **Synchronous scans for MVP**: POST /api/scan blocks until complete (~60s max). Phase 2/3 can add async polling if needed.
- **next.config must be .mjs**: Next.js 14 does not support TypeScript config files (added in Next.js 15)
- **Lazy DB pool**: `server/db/client.ts` creates Pool on first `query()` call, not at import — required for tests that mock the module

---

## Process Rules (learned from Phase 1)

- Run `pnpm typecheck` before declaring a phase done
- Run `pnpm test` before declaring a phase done — all tests must pass
- Subagents spawned via the Agent tool cannot write files unless Write permission is explicitly granted in session settings — Architect writes all files directly
- Never declare a phase complete without verifying build + tests

---

*Last updated: 2026-03-31 — Phase 2 complete. 14 static checks, gas analysis, proxy detection, per-chain API keys. 32 tests passing, tsc clean. Phase 3 ready to begin.*
