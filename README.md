# T3N Enterprise Payroll Agent

Enterprise payroll system running inside Terminal 3's Trusted Execution Environment (TEE). Executes salary calculations, tax withholding, and batch processing via real T3N contract invocations.

## What This Is

A **real TEE payroll agent** that:
1. Authenticates to T3N testnet via WASM crypto
2. Registers a Rust/WASM payroll contract inside the TEE
3. Invokes `compute-payroll` inside the confidential enclave
4. Returns validated results — status `"validated"`, not `"processed"`

## What This Is NOT

- This is **not** production payroll software
- Disbursement is **not implemented** (returns explicit error)
- Employee records are passed in input (MVP), not read from KV map
- This is a **demo** for the T3N Agent Build Challenge

## Features

- **Real Rust/WASM contract** — 6 exported functions, checked arithmetic, no floating point
- **TEE execution** — payroll computation runs inside the TEE enclave
- **CLI interface** — 8 commands for employee management, payroll processing, contract registration
- **Input validation** — TypeScript (first layer) + Rust (security boundary)
- **Audit trail** — finalize-audit and get-audit-entry functions
- **Honest documentation** — distinguishes offline demo vs live TEE execution

## Quick Start

```bash
git clone https://github.com/daffhaidar/t3n-payroll-agent.git
cd t3n-payroll-agent
npm ci

# Set your API key
export T3N_API_KEY="your-key-here"

# Verify connection
npx tsx src/cli.ts connect

# Register + invoke contract (Phase 3)
npm run contract

# Offline demo (UNSAFE LOCAL DEMO)
npx tsx src/cli.ts add --id EMP-001 --name "Alice" --wallet 0x... --salary 5000.00 --department Engineering --tax 2000
npx tsx src/cli.ts process --offline --cycle test-001 --period-start 2026-08-01 --period-end 2026-08-31 --cap 100000000000
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CLI (commander)                   │
├──────────┬──────────────┬───────────────────────────┤
│  config  │   money.ts   │     validation.ts         │
├──────────┴──────────────┴───────────────────────────┤
│              payroll/                                │
│  ┌─────────────┐  ┌──────────────┐                  │
│  │  offline.ts  │  │   live.ts    │                  │
│  │  (demo)      │  │  (TEE exec)  │                  │
│  └─────────────┘  └──────────────┘                  │
├─────────────────────────────────────────────────────┤
│              t3n/                                    │
│  ┌─────────────┐  ┌──────────────┐                  │
│  │  client.ts   │  │  tenant.ts   │                  │
│  │  (connect)   │  │  (register)  │                  │
│  └─────────────┘  └──────────────┘                  │
├─────────────────────────────────────────────────────┤
│         Terminal 3 TEE (WASM Component)             │
│  • compute-payroll    • execute-disbursement         │
│  • validate-credentials • finalize-audit             │
│  • list-audit-cycles  • get-audit-entry              │
└─────────────────────────────────────────────────────┘
```

## How It Works

### Offline Mode
1. `--offline` flag required — prints `UNSAFE LOCAL DEMO — NOT EXECUTED IN T3N TEE`
2. Computes payroll locally using exact bigint arithmetic
3. Saves results to `.payroll/batches/`

### Live TEE Mode
1. Authenticates to T3N testnet via WASM crypto
2. Resolves contract version from the node
3. Calls `compute-payroll` inside the TEE enclave
4. TEE returns validated results — status set to `"validated"`
5. Sensitive data (salaries, bank details) never exposed to the agent

### Contract Registration
1. Build Rust contract: `cargo build --target wasm32-wasip2 --release`
2. Register: `npm run contract`
3. Contract receives numeric `contract_id` for map ACLs

## Data Model

### Monetary Values
- All monetary values stored as **cents** (bigint/u64) internally
- JSON wire format: decimal string in cents (e.g. `"500000"` = $5,000.00)
- Tax rates: integer basis points (0–10000), e.g. `2000` = 20%

### Employee Data
```json
{
  "id": "EMP-001",
  "walletAddress": "0x...",
  "baseSalaryCents": "500000",
  "department": "Engineering",
  "taxBasisPoints": 2000
}
```

### Payroll Status
- `"calculated"` — offline local computation (UNSAFE DEMO)
- `"validated"` — successful TEE payroll validation
- `"disbursed"` — after real external disbursement succeeds (NOT IMPLEMENTED)
- `"failed"` — real failure

## Testing

```bash
# TypeScript tests (58 tests)
npm test

# Rust tests (15 tests)
cargo test --manifest-path contracts/payroll/Cargo.toml

# Typecheck
npm run typecheck

# Clippy
cargo clippy --manifest-path contracts/payroll/Cargo.toml --all-targets -- -D warnings
```

## Contract Functions

| Function | Status | Description |
|----------|--------|-------------|
| `compute-payroll` | ✅ Implemented | Core payroll computation |
| `finalize-audit` | ✅ Implemented | Audit record finalization |
| `validate-credentials` | ✅ Implemented | Credential validation (MVP) |
| `list-audit-cycles` | ✅ Implemented | Audit history listing |
| `get-audit-entry` | ✅ Implemented | Audit entry retrieval |
| `execute-disbursement` | ❌ NOT IMPLEMENTED | Returns explicit error |

## File Structure

```
t3n-payroll-agent/
├── src/                    # TypeScript source
│   ├── cli.ts              # CLI entry point
│   ├── config.ts           # Environment config
│   ├── money.ts            # Exact bigint arithmetic
│   ├── validation.ts       # Input validation
│   ├── payroll/            # Payroll logic
│   ├── storage/            # Local persistence
│   └── t3n/                # SDK integration
├── contracts/payroll/      # Rust/WASM TEE contract
│   ├── src/                # Rust source
│   ├── wit/                # WIT interface definitions
│   └── Cargo.toml
├── tests/                  # TypeScript tests
├── scripts/                # Deployment scripts
├── proofs/                 # Execution proofs
├── screenshots/            # Verification screenshots
├── BUGS.md                 # Known bugs
├── SECURITY.md             # Security policy
├── ARCHITECTURE.md         # Architecture docs
├── HANDOVER.md             # Handover guide
└── SUBMISSION.md           # Challenge submission
```

## License

MIT
