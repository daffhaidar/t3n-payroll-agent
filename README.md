# T3N Enterprise Payroll Agent

Enterprise payroll system running inside Terminal 3's Trusted Execution Environment (TEE). Executes salary calculations, tax withholding, and batch processing via real T3N contract invocations.

## Features

- **TEE-protected computation** — payroll logic runs inside Terminal 3's confidential enclave via `compute-payroll` contract function
- **Employee management** — add, list, remove employees with persistent storage
- **Batch processing** — process payroll for all employees via TEE or offline demo
- **Tax withholding** — automatic calculation using exact bigint arithmetic (no floating point)
- **Audit trail** — batch history saved locally for compliance
- **Contract registration** — register and manage TEE payroll contracts

## Prerequisites

- Node.js >= 22.12.0
- Terminal 3 API key ([claim here](https://docs.terminal3.io/developers/adk/get-started/prerequisites/request-test-tokens))
- Rust toolchain with `wasm32-wasip2` target (for contract build)

## Setup

```bash
git clone https://github.com/daffhaidar/t3n-payroll-agent.git
cd t3n-payroll-agent
npm install

# Set your API key
export T3N_API_KEY="your-key-here"
```

## Quick Start

```bash
# Verify T3N connection
npx tsx src/cli.ts connect

# Add employees
npx tsx src/cli.ts add --id EMP-001 --name "Alice Chen" --wallet 0x... --salary 5000.00 --department Engineering --tax 2000

# List employees (salary redacted)
npx tsx src/cli.ts list

# Process payroll offline (UNSAFE LOCAL DEMO)
npx tsx src/cli.ts process --offline --cycle cycle-001 --period-start 2026-08-01 --period-end 2026-08-31 --cap 5000000

# Process payroll via TEE (requires registered contract)
npx tsx src/cli.ts process --cycle cycle-001 --period-start 2026-08-01 --period-end 2026-08-31 --cap 5000000

# Register payroll WASM contract
npx tsx src/cli.ts register --wasm path/to/payroll.wasm

# List registered contracts
npx tsx src/cli.ts contracts

# View batch history
npx tsx src/cli.ts history

# Show batch details
npx tsx src/cli.ts show --batch batch-123456
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
2. Register: `t3n-payroll register --wasm path/to/contract.wasm`
3. Contract receives numeric `contract_id` for map ACLs

## Data Model

### Monetary Values
- All monetary values stored as **cents** (bigint) internally
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
- `"disbursed"` — after real external disbursement succeeds
- `"failed"` — real failure

## Testing

```bash
# Run all tests
npm test

# Typecheck
npm run typecheck
```

58 tests covering:
- Money parsing (negative, NaN, scientific notation, >2 decimal places)
- Validation (wallet addresses, employee IDs, cycle IDs, pay periods)
- Offline payroll computation
- Basis points / tax calculation

## File Structure

```
t3n-payroll-agent/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── config.ts           # Environment config
│   ├── money.ts            # Exact bigint arithmetic
│   ├── validation.ts       # Input validation
│   ├── payroll/
│   │   ├── types.ts        # Payroll types
│   │   ├── offline.ts      # Offline computation (UNSAFE DEMO)
│   │   └── live.ts         # TEE execution
│   ├── storage/
│   │   └── offline.ts      # Local JSON persistence
│   └── t3n/
│       ├── client.ts       # T3N connection + auth
│       └── tenant.ts       # Contract registration/execution
├── tests/
│   ├── money.test.ts
│   ├── validation.test.ts
│   └── offline-payroll.test.ts
├── .env                    # API key (gitignored)
├── tsconfig.json
├── package.json
└── README.md
```

## License

MIT
