# ADR-001: Raw SQL over ORM

**Status**: Accepted
**Date**: 2026-03-20

## Decision

Use raw PostgreSQL via the `pg` driver with hand-written SQL migrations. No ORM (Prisma, Drizzle, TypeORM, Sequelize).

## Context

The project needs a relational DB for scan history. The common alternative is an ORM, which generates schema from TypeScript models and manages migrations automatically.

## Reasons

1. **Audit trail clarity** — Security tool users and contributors need to be able to read exactly what SQL runs against their database. An ORM's generated SQL is opaque and can surprise you in production.
2. **Migration integrity** — Hand-numbered `.sql` files in `server/db/migrations/` are immutable once committed. There is no risk of auto-sync silently altering a production table.
3. **No magic schema sync** — ORMs with `push` or `sync` modes have wiped production data. Raw migrations are explicit and irreversible by design.
4. **Simpler dependency surface** — `pg` is a stable, minimal driver. ORMs add substantial weight and version-lock risk.
5. **Query transparency** — Every query in the codebase is readable SQL. No translation layer to debug.

## Trade-offs

- More boilerplate for CRUD than an ORM query builder.
- No type-safe query builder (mitigated by TypeScript return types on the `query()` wrapper).
- Migration management is manual (mitigated by the simple numbered-file convention).

## Consequences

- All schema changes go through `server/db/migrations/NNN_description.sql`.
- `server/db/schema.sql` always reflects the current canonical state.
- The `query<T>()` wrapper in `server/db/client.ts` provides light typing without ORM overhead.
