# Architecture

## Overview

The T3N Enterprise Payroll Agent has three layers:

1. **CLI Layer** (`src/cli.ts`) — User-facing command-line interface
2. **TEE Contract Layer** (`contracts/payroll/`) — Rust/WASM running inside Terminal 3's Trusted Execution Environment
3. **SDK Integration Layer** (`src/t3n/`) — TypeScript SDK connecting CLI to TEE

## Data Flow

```
User CLI → TypeScript SDK → T3N Node → TEE Enclave → WASM Contract
                                         ↓
                                    KV Map Storage
                                    (employees, audit)
```

## Components

### CLI (`src/`)

| Module | Purpose |
|--------|---------|
| `cli.ts` | Command routing, user I/O |
| `config.ts` | Environment parsing, API key loading |
| `money.ts` | Exact bigint arithmetic (no floating point) |
| `validation.ts` | Input validation (wallet, employee ID, cycle ID) |

### TEE Contract (`contracts/payroll/`)

| File | Purpose |
|------|---------|
| `src/lib.rs` | Guest implementation, function dispatch |
| `src/payroll.rs` | Payroll computation (checked arithmetic) |
| `src/audit.rs` | Audit record management |
| `wit/world.wit` | WIT interface definition |

### SDK Integration (`src/t3n/`)

| File | Purpose |
|------|---------|
| `client.ts` | T3N connection + authentication |
| `tenant.ts` | Contract registration + execution |

## Security Model

- **Monetary values**: u64 cents internally, decimal strings on wire
- **Tax rates**: u16 basis points (0–10000)
- **Checked arithmetic**: overflow returns explicit errors
- **No PII in contract output**: employee_id is opaque, no wallet/bank details
- **Private KV maps**: employee records and audit entries stored in tenant-scoped maps
- **ACL scoping**: maps scoped to contract_id

## Offline vs Live

| Mode | Flag | Status | Banner |
|------|------|--------|--------|
| Offline | `--offline` | `"calculated"` | UNSAFE LOCAL DEMO |
| Live TEE | (none) | `"validated"` | N/A |

## Contract Functions

| Function | Status | Description |
|----------|--------|-------------|
| `compute-payroll` | ✅ Implemented | Core payroll computation |
| `finalize-audit` | ✅ Implemented | Audit record finalization |
| `validate-credentials` | ✅ Implemented | Credential validation (MVP) |
| `list-audit-cycles` | ✅ Implemented | Audit history listing |
| `get-audit-entry` | ✅ Implemented | Audit entry retrieval |
| `execute-disbursement` | ❌ NOT IMPLEMENTED | Returns explicit error |

## Known Limitations

1. Employee records passed in input (MVP), not read from KV map
2. Audit records not written to KV map (structure in place, not wired)
3. Disbursement not implemented
4. Agent delegation not yet configured (Phase 4)
