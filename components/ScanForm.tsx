/**
 * ScanForm — the primary user-facing input for submitting a security scan.
 * Validates input with Zod, auto-detects GitHub URL vs contract address,
 * shows chain selector only for addresses, and calls POST /api/scan.
 */
'use client';

import { useState } from 'react';
import { ScanInputSchema, isContractAddress } from '@/lib/schemas';
import { SUPPORTED_CHAINS, CHAIN_LABELS } from '@/lib/constants';
import type { SupportedChain } from '@/lib/constants';

/**
 * Scan input form component.
 * On submit: validates with Zod → POST /api/scan → redirects to /scan/[scanId].
 * @returns Form element with target input, optional chain selector, and submit button
 */
export function ScanForm() {
  const [target, setTarget]       = useState('');
  const [chain, setChain]         = useState<SupportedChain>('ethereum');
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);

  const isAddress   = isContractAddress(target);
  const targetType  = isAddress ? 'address' : 'github';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parseResult = ScanInputSchema.safeParse({
      target,
      targetType,
      chain: isAddress ? chain : undefined,
    });

    if (!parseResult.success) {
      setError(parseResult.error.errors[0]?.message ?? 'Invalid input');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseResult.data),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? 'Scan request failed');
        return;
      }

      // Phase 1: server returns { scanId } → redirect to /scan/[scanId]
      if (data.scanId) {
        window.location.href = `/scan/${data.scanId}`;
      }
    } catch {
      setError('Network error — is the server running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="scan-target" className="text-sm text-white/60">
          GitHub repo URL or contract address
        </label>
        <input
          id="scan-target"
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="https://github.com/user/repo  or  0x..."
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)]"
          disabled={loading}
        />
      </div>

      {/* Show chain selector only when input looks like an address */}
      {isAddress && (
        <div className="flex flex-col gap-2">
          <label htmlFor="scan-chain" className="text-sm text-white/60">
            Chain
          </label>
          <select
            id="scan-chain"
            value={chain}
            onChange={(e) => setChain(e.target.value as SupportedChain)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)]"
            disabled={loading}
          >
            {SUPPORTED_CHAINS.map((c) => (
              <option key={c} value={c} className="bg-gray-900">
                {CHAIN_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !target.trim()}
        className="w-full rounded-lg bg-[var(--brand-green)] px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Scanning…' : 'Scan Now'}
      </button>
    </form>
  );
}
