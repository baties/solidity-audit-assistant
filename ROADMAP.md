# SolidityGuard AI — Roadmap

> Single source of truth for project phase, progress, and next steps.
> Updated by Architect at the end of every agent run.

---

## Current Phase: 2 — Depth ⬜ Next

**Goal**: All 12 vuln categories, gas analysis, multi-chain, proxy detection

---

## Phase Status

| Phase | Goal | Status |
|-------|------|--------|
| **0 — Scaffold** | Repo structure, docker-compose, DB schema, empty route stubs, README skeleton | ✅ Done |
| **1 — MVP** | Scan input → GitHub/Etherscan fetcher → 5 static checks → Claude analysis → risk score → report UI | ✅ Done |
| **2 — Depth** | All 12 vuln categories, gas analysis, multi-chain, proxy detection | ⬜ Planned |
| **3 — Auth & History** | NextAuth GitHub OAuth, scan history, shareable report links | ⬜ Planned |
| **4 — Production** | Rate limiting, public REST API, Docker Hub image, full docs | ⬜ Planned |

---

## Phase 0 Task Breakdown

### Backend (server/api/, server/db/, server/services/, types/)
- [ ] Root `package.json` with all deps, pnpm scripts (`dev`, `build`, `typecheck`, `lint`, `test`)
- [ ] `tsconfig.json` (strict mode)
- [ ] `server/lib/logger.ts` — pino structured logger
- [ ] `types/index.ts` — shared interfaces: `ScanRequest`, `ScanResult`, `VulnerabilityFinding`, `SourceFile`, `Chain`
- [ ] `server/api/scan.ts` — empty stub: `POST /api/scan`
- [ ] `server/api/health.ts` — `GET /api/health` returns 200 + `{ status: "ok" }`
- [ ] `server/api/index.ts` — Express app wiring
- [ ] `server/db/schema.sql` — canonical schema: `scans`, `findings` tables
- [ ] `server/db/migrations/001_initial.sql` — first migration
- [ ] `server/db/client.ts` — pg Pool setup
- [ ] `server/services/etherscan.ts` — empty stub with JSDoc
- [ ] `server/services/github.ts` — empty stub with JSDoc
- [ ] `server/index.ts` — Express entry point

### Frontend (app/, components/, lib/)
- [ ] `app/layout.tsx` — root layout with Tailwind + metadata
- [ ] `app/page.tsx` — landing/scan input page skeleton
- [ ] `app/globals.css` — Tailwind base
- [ ] `components/ScanForm.tsx` — input form stub (GitHub URL or contract address)
- [ ] `components/ReportCard.tsx` — report display stub
- [ ] `components/RiskBadge.tsx` — risk score badge stub
- [ ] `lib/schemas.ts` — Zod schemas: `ScanInputSchema`
- [ ] `lib/constants.ts` — shared constants (chains, API base URL)
- [ ] `next.config.ts` — Next.js config with rewrites to Express API

### AI/Agent (server/agents/)
- [ ] `server/agents/orchestrator.ts` — stub: coordinates fetcher → analyzer → llm pipeline
- [ ] `server/agents/fetcher.ts` — stub: GitHub + Etherscan source retrieval
- [ ] `server/agents/analyzer.ts` — stub: static pattern checks
- [ ] `server/agents/llm.ts` — stub: Claude API calls via tool_use
- [ ] `server/agents/prompts/system.ts` — placeholder system prompt constants

### DevOps (docker/, .env.example)
- [ ] `docker/Dockerfile.app` — multi-stage build (builder + runner)
- [ ] `docker/docker-compose.yml` — services: app, postgres, nginx
- [ ] `docker/nginx.conf` — reverse proxy: /api/ → Express :3001, / → Next.js :3000
- [ ] `.env.example` — all required env vars documented

### Architect (CLAUDE.md, ROADMAP.md, README.md, CONTRIBUTING.md)
- [ ] `ROADMAP.md` — this file ✅
- [ ] `README.md` — project overview, quick-start, env var table, architecture overview
- [ ] `CONTRIBUTING.md` — repo setup, branch naming, PR checklist, code style, test guide

---

## Phase 0 Completion Criteria
- `docker-compose up` starts app + postgres + nginx cleanly
- `tsc --noEmit` passes with zero errors
- All stubs are in place; no feature logic yet
- README and CONTRIBUTING are complete

---

## Decisions & ADRs
- **Raw SQL over ORM**: Explicit migrations, no magic schema sync, easier audit trail → see `docs/adr/001-raw-sql.md` (Phase 1)
- **tool_use over free-form LLM**: Structured output, type-safe parsing, no regex hacks → see `docs/adr/002-tool-use.md` (Phase 1)
- **Express + Next.js coexistence**: Next.js handles frontend + rewrites `/api/*` to Express on :3001 in dev; Nginx routes in prod

---

*Last updated: 2026-03-21 — Phase 1 complete. Phase 2 ready to begin.*
