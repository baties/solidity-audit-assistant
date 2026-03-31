# ADR 003 — Proxy Contract Detection Approach

**Status**: Accepted  
**Date**: 2026-03-31  
**Phase**: 2 — Depth

---

## Context

Smart contract upgradability via proxy patterns (EIP-1967 transparent, UUPS, and EIP-1167 minimal clones)
is now the norm in production DeFi. Auditing only the proxy source gives a misleading picture: the proxy
is usually a thin shell with no business logic. The real attack surface lives in the implementation contract.

The fetcher needed a strategy to:
1. Detect whether a scanned contract is a proxy
2. Resolve the implementation address
3. Fetch and merge the implementation source so both the static analyzer and the LLM can audit the full system

---

## Decision

We use a **two-layer detection strategy**:

### Layer 1 — Source-text pattern matching (`server/services/proxy.ts`)

Scan the fetched Solidity source files for known proxy pattern markers:

| Pattern | Type | SWC relevance |
|---------|------|--------------|
| `proxiableUUID` or `UUPSUpgradeable` | EIP-1967 UUPS | Unprotected upgrades → SWC-105 |
| `TransparentUpgradeableProxy` or `_IMPLEMENTATION_SLOT` or the literal slot hash | EIP-1967 Transparent | Same |
| `Clones`, `LibClone`, or `clone(` | EIP-1167 Minimal | Storage collision risk |
| `delegatecall` anywhere | Unknown proxy | Custom proxy |

Detection is performed in priority order — first match wins. This avoids false positives from contracts
that import both UUPS and the raw slot constant.

### Layer 2 — EIP-1967 storage slot read (`fetchImplementationIfProxy` in `etherscan.ts`)

If source-level detection confirms a proxy, we read storage slot
`0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`
(keccak256("eip1967.proxy.implementation") − 1) via Etherscan's `eth_getStorageAt` proxy endpoint.

- A non-zero result gives us the live implementation address.
- We then call `fetchContractSource` on that address to get the implementation source.
- Files are tagged with `implementation(<address>)/` prefix so the analyzer and LLM can distinguish layers.
- A synthetic `__proxy_info__.txt` file is prepended to the source list with the proxy relationship details.

---

## Rationale for this approach over alternatives

| Alternative | Why rejected |
|------------|-------------|
| Bytecode analysis (detect minimal proxy `3d3d3d73...` pattern) | Requires RPC access; adds dependency on ethers.js calls in the scan path |
| Etherscan's contract verification UI links | Not available via their public API in a reliable, structured form |
| Always fetching both proxy and implementation by default | Unnecessary for non-proxy contracts; wastes API quota |
| Requiring the user to specify "this is a proxy" | Bad UX — defeats the point of automated analysis |

---

## Limitations & future work

- **EIP-1167 minimal clones**: the implementation address is encoded in the bytecode, not an EIP-1967 slot.
  Layer 2 (slot read) will return null for these. The LLM is still informed of the proxy pattern via Layer 1.
  A future enhancement could call `eth_getCode` and parse the clone bytecode to extract the address.
- **Custom proxies**: contracts that use `delegatecall` without EIP-1967 slots will be detected by Layer 1
  but Layer 2 will return null. The LLM note still flags the auditor to look for the implementation.
- **GitHub repos**: proxy detection is applied only to address scans. For GitHub repos the source is already
  complete (proxy + implementation in the same repo is the developer's responsibility).

---

## Files changed

- `server/services/proxy.ts` — new service: `detectProxyFromSource()`
- `server/services/etherscan.ts` — new export: `fetchImplementationIfProxy()`
- `server/agents/fetcher.ts` — proxy detection + implementation fetch integrated into pipeline
- `server/agents/prompts/system.ts` — LLM instructed how to interpret `__proxy_info__.txt` and audit proxy systems
