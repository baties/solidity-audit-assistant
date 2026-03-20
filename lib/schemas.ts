/**
 * Zod schemas for client-side input validation.
 * Mirrors the server-side ScanRequest type — both sides validate independently.
 * Import ScanInputSchema into ScanForm for form validation.
 */
import { z } from 'zod';

/** Validates a scan form submission — GitHub URL or EVM contract address + optional chain. */
export const ScanInputSchema = z.object({
  target: z
    .string()
    .min(1, 'Target is required')
    .max(500, 'Target must be 500 characters or less'),
  targetType: z.enum(['github', 'address']),
  chain: z
    .enum(['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc'])
    .optional(),
});

export type ScanInput = z.infer<typeof ScanInputSchema>;

/**
 * Returns true if the input string looks like an EVM contract address.
 * Used by ScanForm to auto-detect targetType and show the chain selector.
 * @param input - Raw user input from the scan target field
 * @returns true if input matches the 0x + 40 hex chars pattern
 */
export function isContractAddress(input: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(input.trim());
}
