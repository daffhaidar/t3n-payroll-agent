# T3N Enterprise Payroll Agent

Enterprise payroll system running inside Terminal 3's Trusted Execution Environment (TEE). Executes salary calculations, tax withholding, and batch processing without exposing sensitive employee data.

## Features

- **TEE-protected computation** — all payroll logic runs inside Terminal 3's confidential enclave
- **Employee management** — add, list, remove employees with persistent storage
- **Batch processing** — process payroll for all employees in one TEE-secured batch
- **Tax withholding** — automatic calculation of gross → net with configurable tax rates
- **Audit trail** — batch history saved locally for compliance

## Prerequisites

- Node.js 18+
- Terminal 3 API key ([claim here](https://docs.terminal3.io/developers/adk/get-started/prerequisites/request-test-tokens))

## Setup

```bash
# Clone and install
git clone <repo-url>
cd t3n-payroll-agent
npm install

# Set your API key
cp .env.example .env
# Edit .env with your T3N_API_KEY
export T3N_API_KEY="your-key-here"
```

## Usage

```bash
# Connect to T3N testnet
npx tsx cli.ts connect

# Add employees
npx tsx cli.ts add --id EMP-001 --name "Alice Chen" --wallet 0x... --salary 5000 --department Engineering --tax 0.2
npx tsx cli.ts add --id EMP-002 --name "Bob Martinez" --wallet 0x... --salary 4200 --department Design --tax 0.18

# List all employees
npx tsx cli.ts list

# Process payroll (runs inside TEE)
npx tsx cli.ts process

# View batch history
npx tsx cli.ts history

# Show specific batch
npx tsx cli.ts show --batch batch-1724737385000
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 CLI Interface                    │
├─────────────────────────────────────────────────┤
│              Payroll Engine                      │
│  • Employee management                           │
│  • Tax calculation                               │
│  • Batch processing                              │
├─────────────────────────────────────────────────┤
│         Terminal 3 TEE (WASM)                   │
│  • Cryptographic operations                      │
│  • Authentication                                │
│  • Trust anchor verification                     │
└─────────────────────────────────────────────────┘
```

## How It Works

1. **Authentication** — connects to T3N testnet using API key and WASM crypto
2. **Employee storage** — persists employee data locally in `.payroll/`
3. **Payroll processing** — calculates gross → tax → net for each employee
4. **Batch logging** — saves results to `.payroll/batches/` for audit

## Known Limitations

- **Contract registration** — SDK's `tenant_contracts.register()` has a known bug (server expects `script_name` but SDK sends `name`). Payroll computation works, but on-chain persistence is blocked pending SDK fix.
- **Testnet only** — currently connected to T3N testnet

## File Structure

```
t3n-payroll-agent/
├── cli.ts              # Main CLI entry point
├── quickstart.ts       # Minimal auth demo
├── .env                # Environment config (gitignored)
├── .payroll/           # Persistent data
│   ├── employees.json  # Employee records
│   └── batches/        # Batch history
├── package.json
└── README.md
```

## License

MIT
