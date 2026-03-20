# Contributing to SolidityGuard AI

Thank you for contributing to an open-source security tool. Please read this guide before opening a PR.

---

## Repo Setup

```bash
# Prerequisites: Node.js 20+, pnpm 8+, Docker

git clone https://github.com/your-org/solidityguard.git
cd solidityguard
pnpm install
cp .env.example .env
# Edit .env with your API keys

# Start full stack
docker-compose up

# Or start dev servers only (requires local Postgres)
pnpm dev
```

---

## Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<short-description>` | `feat/reentrancy-detector` |
| Bug fix | `fix/<short-description>` | `fix/scan-timeout-handling` |
| Docs | `docs/<short-description>` | `docs/api-reference` |
| Refactor | `refactor/<short-description>` | `refactor/fetcher-error-types` |
| Chore | `chore/<short-description>` | `chore/update-deps` |

Always branch off `main`. Never push directly to `main`.

---

## PR Checklist

Before opening a pull request:

- [ ] `pnpm typecheck` passes — zero TypeScript errors
- [ ] `pnpm lint` passes — no ESLint violations
- [ ] `pnpm test` passes — all tests green
- [ ] `docker-compose up` starts cleanly
- [ ] All new exported functions have JSDoc (`@param`, `@returns`, `@throws`)
- [ ] All new files have a 2–4 line header comment
- [ ] No `console.log` in server code — use `pino` logger
- [ ] No secrets or `.env` files committed
- [ ] No `any` in TypeScript without an explanatory inline comment
- [ ] All user inputs validated with Zod
- [ ] If adding a new dependency: state name + reason in the PR description
- [ ] If changing DB schema: include migration SQL in `server/db/migrations/`
- [ ] `README.md` updated if behaviour changes or a phase completes
- [ ] `ROADMAP.md` updated if a phase item is completed

---

## Code Style

**TypeScript**
- Strict mode — no `any` without comment
- Named exports everywhere (except Next.js page/layout default exports)
- `async/await` only — no `.then()` chains
- Custom `Error` subclasses for domain errors (`SourceNotVerifiedError`, `RateLimitError`, etc.)
- Files and functions under 200 lines — extract when larger

**Logging**
- Server code: `import { logger } from '../lib/logger'` — use `logger.info/warn/error/debug`
- Never `console.log` in server or agent code
- Always include `scanId` in scan-related log lines

**Comments**
- File header: 2–4 lines explaining what the module does and what it connects to
- Exported functions: full JSDoc block
- Non-obvious logic: inline comment explaining *why*, not *what*
- Prompt strings: comment explaining the design rationale

**No dead code** — delete it. Git preserves history.

---

## File Ownership

| Area | Paths | Notes |
|------|-------|-------|
| Frontend | `app/`, `components/`, `lib/` | Next.js App Router + Tailwind + shadcn/ui |
| Backend | `server/api/`, `server/db/`, `server/services/`, `types/` | Express + raw SQL |
| AI Pipeline | `server/agents/` | Claude API via `tool_use` only |
| DevOps | `docker/`, `docker-compose.yml`, `nginx.conf`, `.env.example` | Docker + Nginx |
| Docs | `CLAUDE.md`, `ROADMAP.md`, `README.md`, `CONTRIBUTING.md`, `docs/` | Architecture decisions |

Respect boundaries — don't make LLM/Etherscan/GitHub calls from `app/` or `components/`.

---

## Running Tests

```bash
pnpm test              # run all tests (vitest)
pnpm test --watch      # watch mode
pnpm test server/      # run only server tests
```

Integration tests hit a real PostgreSQL instance — ensure your `.env` has a valid `DATABASE_URL` pointing to a test database. Do not mock the database in integration tests.

---

## Adding a Dependency

1. State the package name and reason in your PR description
2. Avoid paid SaaS SDKs — all infrastructure must be self-hostable
3. Prefer packages already in the ecosystem (check `package.json` first)
4. Never introduce: Prisma, Convex, Clerk, Firebase, Supabase

---

## DB Schema Changes

1. Never edit existing migration files
2. Create a new numbered file: `server/db/migrations/002_description.sql`
3. Update `server/db/schema.sql` to reflect the new canonical state
4. Include the migration SQL in your PR description

---

## Questions?

Open a GitHub Discussion or file an issue. For security vulnerabilities in SolidityGuard itself, email security@your-org.com (do not open a public issue).

---

*MIT License — by contributing you agree your code is released under MIT.*
