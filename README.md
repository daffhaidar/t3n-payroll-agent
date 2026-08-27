# T3N Payroll Agent

Enterprise payroll computation agent running inside [Terminal 3](https://terminal3.io) TEE (Trusted Execution Environment).

**This is a submission-ready MVP for the Terminal 3 ADK challenge.** It demonstrates TEE-based payroll computation with on-chain contract registration, agent identity, and delegation. It is **not** production payroll software.

## What It Does

1. **Offline mode**: Compute payroll locally for testing (no T3N connection needed)
2. **Live mode**: Execute payroll inside T3N TEE via a registered WASM contract
3. **Agent identity**: Separate agent DID with delegation grants (Phase 4)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  CLI (src/cli.ts)                                   │
│  ├── add/list/remove employees (local storage)      │
│  ├── process --offline (local computation)          │
│  └── process (live TEE execution)                   │
├─────────────────────────────────────────────────────┤
│  Storage (src/storage/offline.ts)                   │
│  ├── employees.json (BigInt as decimal strings)     │
│  └── batches/*.json (atomic writes)                 │
├─────────────────────────────────────────────────────┤
│  T3N SDK (src/t3n/)                                 │
│  ├── client.ts — auth + TenantClient with baseUrl   │
│  └── tenant.ts — canonical contract execution       │
├─────────────────────────────────────────────────────┤
│  WASM Contract (contracts/payroll/)                 │
│  ├── compute-payroll — IMPLEMENTED                  │
│  ├── finalize-audit — MVP STUB                     │
│  ├── validate-credentials — MVP STUB               │
│  ├── list-audit-cycles — MVP STUB                  │
│  ├── get-audit-entry — MVP STUB                    │
│  └── execute-disbursement — NOT IMPLEMENTED        │
└─────────────────────────────────────────────────────┘
```

## TEE Boundary

| Data | In TEE | Visible to Agent |
|------|--------|-----------------|
| Employee salary computation | ✓ | ✓ (agent sends employees in MVP) |
| Tax calculation | ✓ | ✓ |
| Batch totals | ✓ | ✓ |
| Private KV map reads | ✓ (production) | ✗ |

**MVP limitation**: Employee records are passed in the contract input, so the calling agent can see them. In production, they would be read from a private KV map inside the TEE, hidden from the calling agent.

## Threat Model

- **In scope**: Payroll computation integrity, batch cap enforcement, duplicate employee detection
- **Out of scope**: Disbursement (NOT IMPLEMENTED), persistent audit storage (MVP STUB), credential validation (MVP STUB)
- **Trust assumptions**: T3N TEE provides integrity for computation; the agent is semi-trusted (provides input, sees output)

## Quick Start

```bash
# Clone and install
git clone https://github.com/daffhaidar/t3n-payroll-agent.git
cd t3n-payroll-agent
npm ci

# Add an employee (valid 0x address required)
node --import tsx src/cli.ts add \
  --id EMP-001 \
  --name "Alice Engineer" \
  --wallet 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18 \
  --salary 5000.00 \
  --department Engineering \
  --tax 2000

# List employees
node --import tsx src/cli.ts list

# Process offline (local testing)
node --import tsx src/cli.ts process \
  --offline \
  --cycle cycle-2026-08 \
  --period-start 2026-08-01 \
  --period-end 2026-08-31 \
  --cap 1000000000

# View history
node --import tsx src/cli.ts history
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `T3N_API_KEY` | For live mode | Tenant API key from T3N testnet |
| `AGENT_KEY` | For Phase 4 | Separate agent key (must differ from T3N_API_KEY) |
| `CLUSTER` | No | `testnet` (default), `sandbox`, or `production` |
| `PAYROLL_DATA_DIR` | No | Data directory (default: `.payroll`) |

## Contract Functions

| Function | Status | Description |
|----------|--------|-------------|
| `compute-payroll` | IMPLEMENTED | Compute salary, tax, net pay with checked arithmetic |
| `finalize-audit` | MVP STUB | Returns response but does not persist to KV |
| `validate-credentials` | MVP STUB | Returns true for non-empty cycle_id |
| `list-audit-cycles` | MVP STUB | Returns empty array |
| `get-audit-entry` | MVP STUB | Returns empty entries |
| `execute-disbursement` | NOT IMPLEMENTED | Returns explicit error |

## Key Rotation

- `T3N_API_KEY`: Tenant key — rotate via T3N dashboard
- `AGENT_KEY`: Agent key — must be separate from tenant key
- Never commit either key to version control
- The previously shared key is treated as compromised

## Testing

```bash
npm test          # 100 TypeScript tests
cargo test        # 24 Rust tests
cargo clippy      # Zero warnings
```

## Verified Testnet Results

| Field | Value |
|-------|-------|
| Cluster | testnet |
| tenantDid | `did:t3n:aba7511767bc3129a5184c8795c363f976d1fdae` |
| agentDid | `did:t3n:3463e0003357b49c8cbd338d9fc39f96466123af` |
| Contract | `z:aba7511767bc3129a5184c8795c363f976d1fdae:payroll` |
| contract_id | 757 |
| Version | 0.1.0 |
| WASM SHA-256 | `df7f25eb04e2d16fe93a9e3ab2dd6bb913d2be71e2257e9b20d735876107f2cf` |

**Proofs**: `proofs/phase3-*.json`, `proofs/phase4-*.json`

## Limitations

- Employee records visible to calling agent (MVP)
- Audit data not persisted (finalize-audit is a stub)
- Disbursement not implemented
- No production-grade error recovery
- No key rotation automation

## License

MIT
