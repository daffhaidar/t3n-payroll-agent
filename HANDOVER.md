# Handover Guide

## Prerequisites

- Node.js >= 22.12.0
- Rust toolchain with `wasm32-wasip2` target
- Terminal 3 API key (testnet)
- npm

## Environment Variables

```bash
T3N_API_KEY=<your-api-key>
CLUSTER=testnet
AGENT_KEY=<separate-agent-key>  # Phase 4 only
```

## Build Steps

### 1. Install dependencies

```bash
npm ci
```

### 2. Build Rust/WASM contract

```bash
rustup target add wasm32-wasip2
cargo build --release --target wasm32-wasip2 --manifest-path contracts/payroll/Cargo.toml
```

### 3. Verify contract

```bash
cargo test --manifest-path contracts/payroll/Cargo.toml
cargo clippy --manifest-path contracts/payroll/Cargo.toml --all-targets -- -D warnings
```

## Deployment Steps

### 1. Set environment

```bash
export T3N_API_KEY="your-key"
export CLUSTER="testnet"
```

### 2. Register contract

```bash
npm run contract
```

This will:
- Connect to T3N testnet
- Register the WASM contract
- Create KV maps
- Seed demo employees
- Invoke compute-payroll
- Record proof

### 3. Verify registration

```bash
npm run contract  # Second run should show existing contract
```

### 4. Register agent (Phase 4)

```bash
npm run agent
```

This will:
- Register agent identity on T3N
- Create and host agent card
- Create delegation grant
- Run access control tests
- Record evidence

## Contract Versioning

- Contract tail: `payroll` (stable)
- Version: `0.1.0` (bump on changes)
- Re-registration creates new contract_id — update map ACLs

## Contract ID/ACL Update Procedure

1. Register new version: `npm run contract`
2. Note new `contract_id` from output
3. Delete and recreate KV maps with new contract_id
4. Re-seed employee data

## Key Rotation

1. Generate new API key at https://docs.terminal3.io/developers/adk/get-started/prerequisites/request-test-tokens
2. Update `T3N_API_KEY` environment variable
3. Old key becomes invalid immediately

## Agent Revocation

1. Remove agent grant via `agent-auth-update` with empty scripts array
2. Agent can no longer invoke contract functions
3. Revoke via user's own authenticated session

## Monitoring

- Check `proofs/` directory for execution records
- Review `BUGS.md` for known issues
- Monitor T3N testnet status at https://docs.terminal3.io

## Rollback

1. Previous WASM builds are in `contracts/payroll/target/wasm32-wasip2/release/`
2. To rollback: re-register previous version with higher version number
3. Update map ACLs if contract_id changed

## Known Limitations

- Employee records passed in input (MVP), not from KV map
- Audit records not written to KV map
- Disbursement not implemented
- Agent delegation not configured (Phase 4 pending)
