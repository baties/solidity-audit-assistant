/**
 * Claude API wrapper for structured Solidity security analysis.
 * All LLM interactions go through this module — never call @anthropic-ai/sdk directly elsewhere.
 * Uses tool_use with a forced tool call to guarantee typed, parseable output.
 */
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../lib/logger';
import { SYSTEM_PROMPT } from './prompts/system';
import type { SourceFile, VulnerabilityFinding } from '../../types';

/** Max combined source bytes sent to Claude. Prevents context window overload. */
const MAX_SOURCE_BYTES = 80_000;

const client = new Anthropic();

/**
 * Claude tool_use schema for structured vulnerability output.
 * Forced tool call (tool_choice: {type:'tool'}) guarantees Claude always
 * returns machine-parseable output. See docs/adr/002-tool-use.md.
 */
export const VULNERABILITY_TOOL_SCHEMA: Anthropic.Tool = {
  name: 'report_vulnerabilities',
  description: 'Report all security vulnerabilities found in the Solidity code',
  input_schema: {
    type: 'object',
    properties: {
      findings: {
        type: 'array',
        description: 'All vulnerabilities found, sorted by severity (critical first)',
        items: {
          type: 'object',
          properties: {
            id:             { type: 'string' },
            severity:       { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
            title:          { type: 'string' },
            description:    { type: 'string' },
            line:           { type: 'number' },
            filename:       { type: 'string' },
            recommendation: { type: 'string' },
            swcId:          { type: 'string' },
          },
          required: ['id', 'severity', 'title', 'description', 'recommendation'],
        },
      },
      summary:   { type: 'string', description: '2–4 sentence executive summary of the audit' },
      riskScore: { type: 'number', description: '0–100 composite risk score' },
    },
    required: ['findings', 'summary', 'riskScore'],
  },
};

/**
 * Builds the user message sent to Claude.
 * Includes all source files (truncated if needed) and static pre-findings as context.
 * @param files          - Solidity source files
 * @param staticFindings - Pre-computed findings from the static analyzer
 * @returns Formatted user message string
 */
function buildUserMessage(files: SourceFile[], staticFindings: VulnerabilityFinding[]): string {
  let totalBytes = 0;
  const sourceSections: string[] = [];

  for (const file of files) {
    const chunk = `### ${file.filename}\n\`\`\`solidity\n${file.content}\n\`\`\``;
    totalBytes += Buffer.byteLength(chunk, 'utf-8');

    if (totalBytes > MAX_SOURCE_BYTES) {
      sourceSections.push(`### ${file.filename}\n[Truncated — combined source exceeded ${MAX_SOURCE_BYTES / 1000}KB limit]`);
      break;
    }
    sourceSections.push(chunk);
  }

  let message = `## Solidity Source Files\n\n${sourceSections.join('\n\n')}`;

  if (staticFindings.length > 0) {
    const findingLines = staticFindings.map(
      (f) => `- [${f.severity.toUpperCase()}] ${f.title} — ${f.filename ?? 'unknown'}:${f.line ?? '?'}`
    );
    message += `\n\n## Static Analysis Pre-Findings (use as context, not as definitive results)\n${findingLines.join('\n')}`;
  }

  message += '\n\nPlease analyze all source files thoroughly and report vulnerabilities using the report_vulnerabilities tool.';

  return message;
}

/** Shape of the tool_use input block returned by Claude. */
interface ToolInput {
  findings: Array<{
    id: string;
    severity: string;
    title: string;
    description: string;
    line?: number;
    filename?: string;
    recommendation: string;
    swcId?: string;
  }>;
  summary: string;
  riskScore: number;
}

/**
 * Performs deep security analysis of Solidity source using Claude claude-sonnet-4-20250514.
 * Uses structured tool_use (forced) to get typed VulnerabilityFinding[] — no regex parsing.
 * @param files          - Solidity source files to analyze
 * @param staticFindings - Preliminary findings from the static analyzer (LLM context)
 * @returns Enriched findings, executive summary, and 0–100 risk score
 * @throws Error if Claude API call fails or returns no tool_use block
 */
export async function analyzeWithClaude(
  files: SourceFile[],
  staticFindings: VulnerabilityFinding[]
): Promise<{ findings: VulnerabilityFinding[]; summary: string; riskScore: number }> {
  const start = Date.now();
  logger.info(
    { service: 'claude', model: 'claude-sonnet-4-20250514', files: files.length, staticFindings: staticFindings.length },
    'llm analysis started'
  );

  const userMessage = buildUserMessage(files, staticFindings);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [VULNERABILITY_TOOL_SCHEMA],
    // Force Claude to use our tool — guarantees structured output, no free-form fallback
    tool_choice: { type: 'tool', name: 'report_vulnerabilities' },
    messages: [{ role: 'user', content: userMessage }],
  });

  logger.debug(
    { service: 'claude', stopReason: response.stop_reason, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    'claude response received'
  );

  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );

  if (!toolUseBlock || toolUseBlock.name !== 'report_vulnerabilities') {
    throw new Error(`Claude did not return expected tool_use block. Stop reason: ${response.stop_reason}`);
  }

  const input = toolUseBlock.input as ToolInput;

  const findings: VulnerabilityFinding[] = input.findings.map((f, i) => ({
    id: f.id || `llm-${String(i + 1).padStart(3, '0')}`,
    severity: f.severity as VulnerabilityFinding['severity'],
    title: f.title,
    description: f.description,
    recommendation: f.recommendation,
    line: f.line,
    filename: f.filename,
    swcId: f.swcId,
  }));

  logger.info(
    { service: 'claude', findings: findings.length, riskScore: input.riskScore, durationMs: Date.now() - start },
    'llm analysis completed'
  );

  return { findings, summary: input.summary, riskScore: input.riskScore };
}
