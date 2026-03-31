/**
 * Unit tests: static analyzer — all 14 pattern checks (12 SWC + 2 gas) verified against
 * known Solidity snippets. No external dependencies — pure function tests.
 */
import { describe, it, expect } from 'vitest';
import { runStaticAnalysis, STATIC_CHECK_IDS } from '../analyzer';
import type { SourceFile } from '../../../types';

function file(content: string, filename = 'Test.sol'): SourceFile {
  return { filename, content };
}

// ─────────────────────────────────────────────────────────────────
// Phase 1 checks (preserved from original)
// ─────────────────────────────────────────────────────────────────

describe('runStaticAnalysis — Phase 1 checks', () => {
  it('returns only reentrancy finding for safe Solidity 0.8 withdraw pattern', async () => {
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
    // The reentrancy check fires on .call{value: — expected; static check is conservative
    expect(findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.REENTRANCY))).toHaveLength(1);
    // No tx.origin, no selfdestruct, no send, no old pragma — these must not fire
    expect(findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.TX_ORIGIN))).toHaveLength(0);
    expect(findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.SELFDESTRUCT))).toHaveLength(0);
    expect(findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.UNCHECKED_CALL))).toHaveLength(0);
    expect(findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.INTEGER_OVERFLOW))).toHaveLength(0);
  });

  it('flags tx.origin usage (SWC-115)', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.8.0;
contract Auth {
    address owner;
    function privileged() external {
        require(tx.origin == owner, "not owner");
    }
}`),
    ]);
    const txFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.TX_ORIGIN));
    expect(txFindings).toHaveLength(1);
    expect(txFindings[0].severity).toBe('high');
    expect(txFindings[0].swcId).toBe('SWC-115');
  });

  it('flags .send() unchecked return (SWC-104)', async () => {
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

  it('flags pragma solidity 0.5–0.7 for overflow risk (SWC-101)', async () => {
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

  it('flags selfdestruct (SWC-106)', async () => {
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

  it('flags deprecated suicide() alias (SWC-106)', async () => {
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
      file(
        `pragma solidity ^0.8.0;\ncontract C {\n    function f() external {\n        address(this).send(1);\n    }\n}`,
        'contracts/C.sol',
      ),
    ]);
    const sendFinding = findings.find(f => f.id.startsWith(STATIC_CHECK_IDS.UNCHECKED_CALL));
    expect(sendFinding?.filename).toBe('contracts/C.sol');
    expect(sendFinding?.line).toBe(4); // line 4: the .send() call
  });

  it('scans multiple files and aggregates findings', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.7.0;\ncontract A {}`, 'A.sol'),
      file(
        `pragma solidity ^0.8.0;\ncontract B { function k() external { selfdestruct(payable(msg.sender)); } }`,
        'B.sol',
      ),
    ]);
    const overflowFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.INTEGER_OVERFLOW));
    const sdFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.SELFDESTRUCT));
    expect(overflowFindings).toHaveLength(1);
    expect(overflowFindings[0].filename).toBe('A.sol');
    expect(sdFindings).toHaveLength(1);
    expect(sdFindings[0].filename).toBe('B.sol');
  });
});

// ─────────────────────────────────────────────────────────────────
// Phase 2 checks — 7 new SWC patterns
// ─────────────────────────────────────────────────────────────────

describe('runStaticAnalysis — Phase 2 SWC checks', () => {
  it('flags unprotected mint function — no access modifier (SWC-105)', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.8.0;
contract Token {
    mapping(address => uint256) public balanceOf;
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
}`),
    ]);
    const acFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.ACCESS_CONTROL));
    expect(acFindings).toHaveLength(1);
    expect(acFindings[0].severity).toBe('high');
    expect(acFindings[0].swcId).toBe('SWC-105');
  });

  it('does NOT flag mint function that has an access modifier (SWC-105 negative)', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.8.0;
contract Token {
    address owner;
    modifier onlyOwner() { require(msg.sender == owner); _; }
    mapping(address => uint256) public balanceOf;
    function mint(address to, uint256 amount) external onlyOwner {
        balanceOf[to] += amount;
    }
}`),
    ]);
    const acFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.ACCESS_CONTROL));
    expect(acFindings).toHaveLength(0);
  });

  it('flags block.timestamp usage (SWC-116)', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.8.0;
contract Lottery {
    function pickWinner() external {
        require(block.timestamp > endTime, "not ended");
    }
}`),
    ]);
    const tsFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.TIMESTAMP_DEPENDENCE));
    expect(tsFindings).toHaveLength(1);
    expect(tsFindings[0].severity).toBe('low');
    expect(tsFindings[0].swcId).toBe('SWC-116');
  });

  it('flags deprecated now alias for block.timestamp (SWC-116)', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.6.0;
contract Vesting {
    function release() external {
        require(now >= vestingEnd, "too early");
    }
}`),
    ]);
    const tsFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.TIMESTAMP_DEPENDENCE));
    expect(tsFindings).toHaveLength(1);
  });

  it('flags blockhash used as randomness source (SWC-120)', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.8.0;
contract BadRandom {
    function random() external view returns (uint256) {
        return uint256(blockhash(block.number - 1)) % 100;
    }
}`),
    ]);
    const randFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.BAD_RANDOMNESS));
    expect(randFindings).toHaveLength(1);
    expect(randFindings[0].severity).toBe('high');
    expect(randFindings[0].swcId).toBe('SWC-120');
  });

  it('flags block.difficulty used as randomness (SWC-120)', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.8.0;
contract Dice {
    function roll() external view returns (uint256) {
        return uint256(keccak256(abi.encode(block.difficulty, msg.sender))) % 6;
    }
}`),
    ]);
    const randFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.BAD_RANDOMNESS));
    expect(randFindings).toHaveLength(1);
  });

  it('flags ERC20 approve() for front-running race condition (SWC-114)', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.8.0;
contract ERC20 {
    mapping(address => mapping(address => uint256)) public allowance;
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        return true;
    }
}`),
    ]);
    const frFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.FRONT_RUNNING));
    expect(frFindings).toHaveLength(1);
    expect(frFindings[0].severity).toBe('medium');
    expect(frFindings[0].swcId).toBe('SWC-114');
  });

  it('flags unbounded loop over array.length as DoS risk (SWC-113)', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.8.0;
contract Distributor {
    address[] public recipients;
    function distribute() external {
        for (uint256 i = 0; i < recipients.length; i++) {
            payable(recipients[i]).transfer(1 ether);
        }
    }
}`),
    ]);
    const dosFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.DENIAL_OF_SERVICE));
    expect(dosFindings).toHaveLength(1);
    expect(dosFindings[0].severity).toBe('medium');
    expect(dosFindings[0].swcId).toBe('SWC-113');
  });

  it('flags pragma solidity < 0.5.0 for uninitialized storage risk (SWC-109)', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.4.24;
contract Vulnerable {
    struct Proposal { address target; uint256 value; }
    Proposal[] public proposals;
    function submit() public {
        Proposal p; // uninitialized storage pointer — aliases proposals[0]
        p.target = msg.sender;
    }
}`),
    ]);
    const storageFindings = findings.filter(f =>
      f.id.startsWith(STATIC_CHECK_IDS.UNINITIALIZED_STORAGE),
    );
    expect(storageFindings).toHaveLength(1);
    expect(storageFindings[0].severity).toBe('high');
    expect(storageFindings[0].swcId).toBe('SWC-109');
  });

  it('does NOT flag pragma 0.5.x for SWC-109 (only 0.0–0.4 range)', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.5.17;\ncontract C {}`),
    ]);
    const storageFindings = findings.filter(f =>
      f.id.startsWith(STATIC_CHECK_IDS.UNINITIALIZED_STORAGE),
    );
    // 0.5.x is covered by INTEGER_OVERFLOW (SWC-101) — not uninitialized storage
    expect(storageFindings).toHaveLength(0);
    const overflowFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.INTEGER_OVERFLOW));
    expect(overflowFindings).toHaveLength(1);
  });

  it('flags function-type variable for arbitrary jump risk (SWC-127)', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.8.0;
contract WithFunctionVar {
    function execute(bytes memory data) external {
        function(bytes memory) internal returns (bool) handler = defaultHandler;
        handler(data);
    }
    function defaultHandler(bytes memory) internal returns (bool) { return true; }
}`),
    ]);
    const jumpFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.ARBITRARY_JUMP));
    expect(jumpFindings).toHaveLength(1);
    expect(jumpFindings[0].severity).toBe('high');
    expect(jumpFindings[0].swcId).toBe('SWC-127');
  });
});

// ─────────────────────────────────────────────────────────────────
// Phase 2 — gas analysis checks
// ─────────────────────────────────────────────────────────────────

describe('runStaticAnalysis — Phase 2 gas checks', () => {
  it('flags array.length read in loop condition as gas inefficiency', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.8.0;
contract Gas {
    uint256[] public values;
    function sum() external view returns (uint256 total) {
        for (uint256 i = 0; i < values.length; i++) {
            total += values[i];
        }
    }
}`),
    ]);
    const gasFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.GAS_LOOP_LENGTH));
    expect(gasFindings).toHaveLength(1);
    expect(gasFindings[0].severity).toBe('info');
    expect(gasFindings[0].swcId).toBeUndefined();
  });

  it('flags storage array .push() inside a for loop as gas inefficiency', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.8.0;
contract BatchPush {
    uint256[] public stored;
    function batchAdd(uint256[] memory items) external {
        for (uint256 i = 0; i < items.length; i++) {
            stored.push(items[i]);
        }
    }
}`),
    ]);
    const gasFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.GAS_STORAGE_WRITE));
    expect(gasFindings).toHaveLength(1);
    expect(gasFindings[0].severity).toBe('info');
  });

  it('does NOT flag .push() outside a loop', async () => {
    const findings = await runStaticAnalysis([
      file(`pragma solidity ^0.8.0;
contract Safe {
    uint256[] public stored;
    function addOne(uint256 value) external {
        stored.push(value);
    }
}`),
    ]);
    const gasFindings = findings.filter(f => f.id.startsWith(STATIC_CHECK_IDS.GAS_STORAGE_WRITE));
    expect(gasFindings).toHaveLength(0);
  });
});
