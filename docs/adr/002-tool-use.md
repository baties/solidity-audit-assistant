# ADR-002: Claude tool_use over Free-Form Output

**Status**: Accepted
**Date**: 2026-03-20

## Decision

All Claude API calls use the `tool_use` feature with a typed JSON schema (`VULNERABILITY_TOOL_SCHEMA` in `server/agents/llm.ts`). Claude is never asked to return findings as plain text or markdown.

## Context

The LLM needs to return structured vulnerability findings: severity, title, description, line number, filename, recommendation. There are two approaches:

1. **Free-form**: ask Claude to return JSON in its text response, then parse it with regex or `JSON.parse`.
2. **tool_use**: define a JSON Schema tool, call with `tool_choice: { type: 'any' }`, and receive a guaranteed machine-parseable `tool_result` block.

## Reasons

1. **Type safety** — The Anthropic SDK's `tool_use` response is structurally validated. `JSON.parse` on free-form text can silently produce wrong shapes.
2. **No regex hacks** — Extracting JSON from LLM markdown (` ```json ... ``` ` blocks) is fragile. It breaks when the model adds a preamble sentence or wraps differently.
3. **Schema enforcement** — `required` fields in the tool schema mean Claude cannot omit `severity` or `recommendation` — the call fails fast if it does, which is better than silently missing fields.
4. **Consistent output** — Models are explicitly trained to honour tool schemas. Free-form JSON output quality varies across prompts and model versions.
5. **Easier testing** — Stubs can return a valid tool schema shape directly; no mock LLM text parsing needed.

## Trade-offs

- Slightly more setup (defining the schema constant).
- Tool calls consume slightly more tokens than a plain text response.

## Consequences

- `server/agents/llm.ts` is the only place that calls the Anthropic SDK.
- `VULNERABILITY_TOOL_SCHEMA` is the single source of truth for the output shape.
- Parsing logic in Phase 1 casts `tool_use.input` directly to `VulnerabilityFinding[]`.
