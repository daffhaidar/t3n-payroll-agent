# T3N Payroll Agent — Submission Document

## Problem

Enterprise payroll systems require tamper-proof computation. Tax withholding, salary calculations, and batch disbursements must be verifiable and untamerable. Traditional systems rely on operator trust; a compromised operator can alter tax rates, inflate salaries, or redirect payments.

## Enterprise Usefulness

- **Integrity**: TEE ensures payroll computation cannot be tampered with
- **Compliance**: Cryptographic attestation of computation environment
- **Automation**: Agent delegation enables hands-off payroll processing
- **Safety**: Batch caps prevent accidental over-payment; checked arithmetic prevents overflow

## Architecture

```
CLI (TypeScript) → T3N SDK → WASM Contract (Rust) → TEE Execution
     ↓                              ↓
  Local Storage                KV Maps (production)
  (employees.json)             (private, encrypted)
```

- **TypeScript**: CLI, validation, storage, T3N integration
- **Rust/WASM**: Core payroll computation with checked arithmetic
- **T3N TEE**: Trusted execution environment for contract runs

## TEE Boundary

| Data | In TEE | Visible to Agent |
|------|--------|-----------------|
| Salary computation | Yes | Yes (MVP) / No (production) |
| Tax calculation | Yes | Yes (MVP) / No (production) |
| Batch totals | Yes | Yes |
| Employee records | Yes (MVP input) | Yes (MVP) / No (production KV) |

**MVP limitation**: Employee records are passed in the contract input. In production, they would be read from a private KV map inside the TEE, invisible to the calling agent.

## Threat Model

- **TEE integrity**: Computation cannot be tampered with during execution
- **Agent trust**: Semi-trusted — provides input, sees output (MVP). Production agents would not see individual salaries
- **Batch caps**: Enforced in both TypeScript and Rust layers
- **Duplicate detection**: Employee IDs validated for uniqueness
- **Checked arithmetic**: Overflow impossible in Rust contract

## Setup

```bash
git clone https://github.com/daffhaidar/t3n-payroll-agent.git
cd t3n-payroll-agent
npm ci
```

## Demo Flow

1. **Add employee**: `node --import tsx src/cli.ts add --id EMP-001 --name "Alice" --wallet 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18 --salary 5000.00 --department Engineering --tax 2000`
2. **Process offline**: `node --import tsx src/cli.ts process --offline --cycle cycle-001 --period-start 2026-08-01 --period-end 2026-08-31 --cap 1000000000`
3. **View history**: `node --import tsx src/cli.ts history`
4. **(Live)**: Set T3N_API_KEY, run `node --import tsx src/cli.ts process --cycle ...` without --offline

## Verified Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm test` | PASS (100 tests) |
| `npm audit --omit=dev` | PASS (0 vulnerabilities) |
| `cargo fmt --check` | PASS |
| `cargo test` | PASS (24 tests + 1 doc-test) |
| `cargo clippy -D warnings` | PASS |
| `cargo build --target wasm32-wasip2` | PASS |
| `git diff --check` | PASS |
| CLI smoke test | PASS |
| No secrets in source | PASS |
| No secrets in git history | PASS |

## Known Limitations

1. Employee records visible to calling agent (MVP design)
2. Audit persistence is a stub (finalize-audit returns response, does not write)
3. Disbursement not implemented (explicit error)
4. No encryption at rest for local storage
5. No production-grade error recovery

## Bugs Encountered

1. **BigInt serialization crash**: `JSON.stringify` cannot serialize BigInt. Fixed with decimal string DTOs
2. **CLI --offline required**: Made optional so live mode is reachable
3. **TenantClient missing baseUrl**: Added `getNodeUrl()` per SDK v5.2.0 requirements
4. **contract_id:0 fabrication**: Removed sentinel fallback, now exits with BLOCKED
5. **MAX_BATCH_CAP wrong**: Corrected from 100B ($1B) to 1B ($10M)

## Maintenance/Handover Plan

### Before Production
1. Rotate T3N_API_KEY (previously shared key is compromised)
2. Obtain separate AGENT_KEY
3. Deploy contract version 0.1.1 (bump in Cargo.toml, world.wit, TS constants)
4. Implement KV map reads for employee privacy
5. Implement audit persistence

### Codebase Health
- 100 TypeScript tests, 24 Rust tests
- CI workflow for PR/push verification
- Clippy-clean, fmt-clean
- All contract functions labeled IMPLEMENTED / MVP STUB / NOT IMPLEMENTED

## Does the Author Want to Continue?

Yes, contingent on T3N testnet credits and a production-grade audit trail implementation. The author is available for handover and further development.

## Repository

https://github.com/daffhaidar/t3n-payroll-agent

Branch: `fix/submission-readiness`

## Screenshot Placeholders

BLOCKED — screenshots require a running T3N testnet session with valid credentials.

Human action checklist:
- [ ] Rotate T3N_API_KEY
- [ ] Obtain separate AGENT_KEY
- [ ] Run live registration and capture output
- [ ] Run live execution and capture output
- [ ] Capture agent card hosting result
- [ ] Create Google Doc from this markdown
