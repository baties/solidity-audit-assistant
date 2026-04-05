# Contributing to Solidity Smart Audit

Thank you for helping make smart contract security tools better and more accessible.  
Please read this guide before opening a PR.

---

## Table of Contents

- [Repo Setup](#repo-setup)
- [Branch Naming](#branch-naming)
- [PR Checklist](#pr-checklist)
- [Code Style](#code-style)
- [File Ownership](#file-ownership)
- [Running Tests](#running-tests)
- [Adding a Dependency](#adding-a-dependency)
- [DB Schema Changes](#db-schema-changes)
- [Reporting Security Vulnerabilities](#reporting-security-vulnerabilities)

---

## Repo Setup

**Prerequisites**: Node.js 20+, pnpm 8+, Docker

```bash
# Clone the repo
git clone https://github.com/batis/solidity-audit-assistant.git
cd solidity-audit-assistant

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys (see README for the full table)

# Start the full stack
docker-compose -f docker/docker-compose.yml up

# Or start dev servers only (requires a local Postgres instance)
pnpm dev
```

---

## Branch Naming

Always branch off `main`. Never push directly to `main`.

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<short-description>` | `feat/reentrancy-detector` |
| Bug fix | `fix/<short-description>` | `fix/scan-timeout-handling` |
| Docs | `docs/<short-description>` | `docs/api-reference` |
| Refactor | `refactor/<short-description>` | `refactor/fetcher-error-types` |
| Chore | `chore/<short-description>` | `chore/update-deps` |

---

## PR Checklist

Before opening a pull request, verify every item:

- [ ] `pnpm typecheck` passes — zero TypeScript errors
- [ ] `pnpm lint` passes — no ESLint violations
- [ ] `pnpm test` passes — all tests green
- [ ] `docker-compose -f docker/docker-compose.yml up` starts cleanly
- [ ] All new exported functions have JSDoc (`@param`, `@returns`, `@throws`)
- [ ] All new files have a 2–4 line header comment explaining what the module does
- [ ] No `console.log` in server code — use the `pino` logger (`server/lib/logger.ts`)
- [ ] No secrets or `.env` files committed
- [ ] No `any` in TypeScript without an explanatory inline comment
- [ ] All user inputs validated with Zod at the request boundary
- [ ] If adding a new dependency: state name + reason in the PR description
- [ ] If changing DB schema: include a new migration in `server/db/migrations/`
- [ ] `README.md` updated if behaviour or features change
- [ ] `ROADMAP.md` updated if a phase item is completed

---

## Code Style

### TypeScript
- Strict mode — `any` only with an explanatory comment on the same line
- Named exports everywhere (except Next.js `page.tsx` / `layout.tsx` default exports)
- `async/await` only — no `.then()` chains
- Custom `Error` subclasses for domain errors (`SourceNotVerifiedError`, `RateLimitError`, etc.)
- Components and route handlers under 200 lines — extract when larger
- No dead code — delete it; git preserves history

### Logging
- All server code: `import { logger } from '@/server/lib/logger'`
- Use `logger.info`, `logger.warn`, `logger.error`, `logger.debug` — never `console.log`
- Always include `scanId` in scan-related log entries

### Comments
- **File header**: 2–4 lines at the top — what the module does and what it connects to
- **Exported functions**: full JSDoc block with `@param`, `@returns`, and `@throws`
- **Non-obvious logic**: inline comment explaining *why*, not *what*
- **No commented-out code** in commits — use git history instead

### Error Handling
- Catch errors at system boundaries (HTTP handlers, external API calls)
- Always log caught errors with `logger.error({ err, context }, 'message')`
- Propagate via `next(err)` in Express route handlers

---

## File Ownership

Respect these boundaries — do not make LLM or external API calls from `app/` or `components/`.

| Area | Paths | Notes |
|------|-------|-------|
| Frontend | `app/`, `components/`, `lib/` | Next.js App Router + Tailwind |
| Backend API | `server/api/`, `types/` | Express route handlers |
| Database | `server/db/` | Raw SQL only — no ORM |
| External Services | `server/services/` | One file per external API |
| AI Pipeline | `server/agents/` | Orchestrator, fetcher, analyzer, LLM client |
| DevOps | `docker/`, `.env.example` | Docker + Nginx configuration |
| Docs | `ROADMAP.md`, `README.md`, `CONTRIBUTING.md`, `docs/` | Architecture decisions |

---

## Running Tests

```bash
pnpm test                  # run all tests (Vitest)
pnpm test:watch            # watch mode
pnpm test server/          # run only server-side tests
```

Tests that hit the database require a running PostgreSQL instance with a valid `DATABASE_URL` in your `.env`. Do not mock the database in integration tests — this has caused past incidents where mock and real behaviour diverged silently.

---

## Adding a Dependency

1. State the package name and the reason in your PR description
2. Prefer packages already in `package.json` before adding new ones
3. All infrastructure must be self-hostable — no paid SaaS SDKs
4. Never introduce: Prisma, Convex, Clerk, Firebase, Supabase

---

## DB Schema Changes

Schema changes follow a strict migration-based flow:

1. **Never edit** existing files in `server/db/migrations/`
2. Create a new numbered file: `server/db/migrations/003_description.sql`
3. Update `server/db/schema.sql` to reflect the new canonical state
4. Include the migration SQL in your PR description so reviewers can see the exact change

---

## Reporting Security Vulnerabilities

**Do not open a public GitHub issue for security vulnerabilities.**

Please email **security@your-org.com** with:
- A description of the vulnerability
- Steps to reproduce
- Potential impact

You will receive a response within 48 hours. We follow responsible disclosure and will coordinate a fix before any public disclosure.

---

*MIT License — by contributing you agree your code is released under the MIT License.*
