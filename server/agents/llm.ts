/**
 * Claude API wrapper for structured Solidity security analysis.
 * All LLM interactions go through this module — never call @anthropic-ai/sdk directly elsewhere.
 * Uses tool_use for structured output instead of free-form text to guarantee type-safe results.
 */
import { logger } from '../lib/logger';
import { SYSTEM_PROMPT } from './prompts/system';
import type { SourceFile, VulnerabilityFinding } from '../../types';

/**
 * Claude tool_use schema for structured vulnerability output.
 *
 * Design rationale: Using tool_use instead of asking Claude to return JSON in plain text
 * guarantees a machine-parseable response without regex hacks. The SDK enforces the schema
 * at call time and returns a typed tool_result block. See docs/adr/002-tool-use.md.
 *
 * Model: claude-sonnet-4-20250514 — best balance of reasoning depth and latency for audit tasks.
 */
export const VULNERABILITY_TOOL_SCHEMA = {
  name: 'report_vulnerabilities',
  description: 'Report all security vulnerabilities found in the Solidity code',
  input_schema: {
    type: 'object' as const,
    properties: {
      findings: {
        type: 'array',
        description: 'All vulnerabilities found, sorted by severity (critical first)',
        items: {
          type: 'object',
          properties: {
            id:             { type: 'string', description: 'Unique finding ID, e.g. llm-001' },
            severity:       { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
            title:          { type: 'string', description: 'Short vulnerability title' },
            description:    { type: 'string', description: 'Full description and impact' },
            line:           { type: 'number', description: 'Source line number if identifiable' },
            filename:       { type: 'string', description: 'Source filename if identifiable' },
            recommendation: { type: 'string', description: 'Specific, actionable remediation advice' },
            swcId:          { type: 'string', description: 'SWC registry ID e.g. SWC-107' },
          },
          required: ['id', 'severity', 'title', 'description', 'recommendation'],
        },
      },
      summary: {
        type: 'string',
        description: '2–4 sentence executive summary of the audit result',
      },
      riskScore: {
        type: 'number',
        description: '0–100 composite risk score (100 = most dangerous)',
      },
    },
    required: ['findings', 'summary', 'riskScore'],
  },
} as const;

/**
 * Performs deep security analysis of Solidity source using Claude claude-sonnet-4-20250514.
 * Uses structured tool_use to get typed VulnerabilityFinding[] output — no regex parsing.
 * @param files          - Solidity source files to analyze
 * @param staticFindings - Preliminary findings from static analyzer (context for Claude)
 * @returns Enriched findings array, executive summary, and 0–100 risk score
 * @throws Error if Claude API call fails or returns unexpected tool_use structure
 */
export async function analyzeWithClaude(
  files: SourceFile[],
  staticFindings: VulnerabilityFinding[]
): Promise<{ findings: VulnerabilityFinding[]; summary: string; riskScore: number }> {
  const start = Date.now();
  logger.info({ service: 'claude', files: files.length, staticFindings: staticFindings.length }, 'llm analysis started');

  // Phase 1 implementation:
  // 1. Build user message: concatenate source files + static findings as context
  // 2. Call Anthropic SDK with model=claude-sonnet-4-20250514, tools=[VULNERABILITY_TOOL_SCHEMA], tool_choice={type:'any'}
  // 3. Extract tool_use block from response, parse input as typed findings
  // 4. Map to VulnerabilityFinding[], return with summary + riskScore
  throw new Error('Not implemented — Phase 1');

  // Unreachable — documents logging pattern for Phase 1
  logger.info(
    { service: 'claude', durationMs: Date.now() - start },
    'llm analysis completed'
  );
}
