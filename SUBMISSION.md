# Submission Guide

## Challenge

T3N Agent Build Challenge — Enterprise Payroll Agent

## Repository

https://github.com/daffhaidar/t3n-payroll-agent

## What Was Built

An enterprise payroll agent that computes salary, tax withholding, and net pay inside Terminal 3's Trusted Execution Environment (TEE).

### Key Features

1. **Real Rust/WASM contract** — 6 exported functions, checked arithmetic, no floating point
2. **TEE execution** — payroll computation runs inside the TEE enclave
3. **CLI interface** — 8 commands for employee management, payroll processing, contract registration
4. **Input validation** — TypeScript (first layer) + Rust (security boundary)
5. **Audit trail** — finalize-audit and get-audit-entry functions
6. **Agent identity** — registered agent with card hosted on T3N
7. **Delegation grant** — user grants agent access to specific functions
8. **Access control tests** — authorized, unauthorized, and revoked scenarios

### What Works

| Component | Status | Evidence |
|-----------|--------|----------|
| TypeScript auth | ✅ | `proofs/phase3-*.json` |
| Rust/WASM build | ✅ | 190KB, 15 unit tests |
| CLI commands | ✅ | 58 TypeScript tests |
| Contract registration | ✅ | contract_id: 754 |
| Contract invocation | ✅ | compute-payroll returns validated results |
| Agent identity | ✅ | Agent card hosted on T3N |
| Delegation grant | ✅ | compute-payroll authorized |
| Authorized access | ✅ | compute-payroll succeeds |
| Unauthorized access | ✅ | execute-disbursement denied |
| Revoked access | ⏭️ | validate-credentials (no egress) |

### Access Control Test Results

| Test | Description | Result |
|------|-------------|--------|
| Authorized | compute-payroll with valid grant | ✅ PASS |
| Unauthorized | execute-disbursement (NOT IMPLEMENTED) | ✅ DENIED |
| Revoked | validate-credentials without egress grant | ⏭️ SKIP |

### Known Limitations

1. Agent uses same key as tenant (demo only — production needs separate AGENT_KEY)
2. Employee records passed in input (MVP), not from KV map
3. Disbursement not implemented (returns explicit error)
4. Audit records not written to KV map

## Screenshots

See `screenshots/README.md` for required verification screenshots.

## Bonus

Will share on X/Twitter and tag @terminal3io.

## Contact

- GitHub: daffhaidar
- HackerOne: daffh
