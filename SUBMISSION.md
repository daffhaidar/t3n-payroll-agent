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
6. **Honest documentation** — distinguishes offline demo vs live TEE execution

### What Works

| Component | Status |
|-----------|--------|
| TypeScript auth | ✅ Verified |
| Rust/WASM build | ✅ 190KB WASM, 15 unit tests pass |
| CLI commands | ✅ 8 commands, 58 TypeScript tests pass |
| Contract registration | ⏳ Pending live verification |
| Contract invocation | ⏳ Pending registration |
| Agent delegation | ❌ Phase 4 (pending registration) |

### Known Blockers

1. Contract registration not verified live (SDK 5.2.0 unknown status)
2. Employee records passed in input (MVP), not from KV map
3. Disbursement not implemented (returns explicit error)

## Screenshots Required

1. `npm run typecheck` — clean output
2. `npm test` — 58/58 pass
3. `cargo test` — 15/15 pass
4. `cargo clippy` — clean
5. WASM build — file size
6. `npm run contract` — registration attempt + result
7. CLI help output
8. Employee list
9. Offline payroll process

## Bonus

Will share on X/Twitter and tag @terminal3io after live verification.

## Contact

- GitHub: daffhaidar
- HackerOne: daffh
