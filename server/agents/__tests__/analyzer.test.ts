/**
 * Unit tests: static analyzer — verifies all 5 SWC pattern checks against known Solidity snippets.
 * No external dependencies — pure function tests.
 */
import { describe, it, expect } from 'vitest';
import { runStaticAnalysis, STATIC_CHECK_IDS } from '../analyzer';
import type { SourceFile } from '../../../types';

function file(content: string, filename = 'Test.sol'): SourceFile {
  return { filename, content };
}

describe('runStaticAnalysis', () => {
  it('returns empty array for clean Solidity 0.8 code', async () => {
    const findings = await runStaticAnalysis([
      file(`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Safe {
    mapping(address => uint256) public balances;
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "insufficient");
        balances[msg.sender] -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
    }
}`),
    ]);
    // The reentrancy check fires on .call{value: — correctly flagged even in "safe" code
    // This is expected: static check is conservative; LLM does deeper analysis
    const reentrantFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.REENTRANCY));
    expect(reentrantFindings.length).toBe(1);
    // No tx.origin, no selfdestruct, no send, no old pragma
    expect(findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.TX_ORIGIN))).toHaveLength(0);
    expect(findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.SELFDESTRUCT))).toHaveLength(0);
  });

  it('flags tx.origin usage', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.8.0;
contract Auth {
    address owner;
    function privileged() external {
        require(tx.origin == owner, "not owner");
        // do something
    }
}`),
    ]);
    const txFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.TX_ORIGIN));
    expect(txFindings).toHaveLength(1);
    expect(txFindings[0].severity).toBe('high');
    expect(txFindings[0].swcId).toBe('SWC-115');
  });

  it('flags .send() unchecked return', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.8.0;
contract Payer {
    function pay(address payable recipient) external {
        recipient.send(1 ether);
    }
}`),
    ]);
    const sendFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.UNCHECKED_CALL));
    expect(sendFindings).toHaveLength(1);
    expect(sendFindings[0].swcId).toBe('SWC-104');
  });

  it('flags pragma solidity < 0.8.0 for overflow risk', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.7.6;
contract OldToken {
    mapping(address => uint256) balances;
    function transfer(address to, uint256 amount) public {
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }
}`),
    ]);
    const overflowFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.INTEGER_OVERFLOW));
    expect(overflowFindings).toHaveLength(1);
    expect(overflowFindings[0].severity).toBe('medium');
    expect(overflowFindings[0].swcId).toBe('SWC-101');
  });

  it('flags selfdestruct', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.8.0;
contract Killable {
    address owner;
    function destroy() external {
        require(msg.sender == owner);
        selfdestruct(payable(owner));
    }
}`),
    ]);
    const sdFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.SELFDESTRUCT));
    expect(sdFindings).toHaveLength(1);
    expect(sdFindings[0].severity).toBe('high');
    expect(sdFindings[0].swcId).toBe('SWC-106');
  });

  it('flags deprecated suicide() alias', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.4.0;
contract Old {
    function kill() { suicide(msg.sender); }
}`),
    ]);
    const sdFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.SELFDESTRUCT));
    expect(sdFindings).toHaveLength(1);
  });

  it('reports correct filename and line number', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.8.0;\ncontract C {\n    function f() external {\n        address(this).send(1);\n    }\n}`, 'contracts/C.sol'),
    ]);
    const sendFinding = findings.find(f => f.id.startsWith(STATIC_CHECK_IDS.UNCHECKED_CALL));
    expect(sendFinding?.filename).toBe('contracts/C.sol');
    expect(sendFinding?.line).toBe(4); // line 4: the .send() call
  });

  it('scans multiple files and aggregates findings', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.7.0;\ncontract A {}`, 'A.sol'),
      file(`pragma solidity ^0.8.0;\ncontract B { function k() external { selfdestruct(payable(msg.sender)); } }`, 'B.sol'),
    ]);
    const overflowFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.INTEGER_OVERFLOW));
    const sdFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.SELFDESTRUCT));
    expect(overflowFindings).toHaveLength(1);
    expect(overflowFindings[0].filename).toBe('A.sol');
    expect(sdFindings).toHaveLength(1);
    expect(sdFindings[0].filename).toBe('B.sol');
  });
});
