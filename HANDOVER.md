# Handover

## What Works

- Full CLI: add/list/remove employees, process offline, history, show
- Rust WASM contract: compute-payroll with checked arithmetic and comprehensive validation
- T3N integration: authentication, contract registration, execution
- Agent identity: separate DID, delegation grants
- 100 TypeScript tests + 24 Rust tests
- CI workflow for PR/push verification

## What Needs a Human

### Before Mainnet
1. **Rotate T3N_API_KEY**: The previously shared key is compromised. Generate a new one from T3N dashboard
2. **Obtain separate AGENT_KEY**: Must be a different credential from the tenant key
3. **Deploy contract version 0.1.1**: Bump version in Cargo.toml, world.wit, and all TS constants
4. **Implement KV map reads**: Replace MVP employee-passing with private KV map reads inside TEE
5. **Implement audit persistence**: finalize-audit should write to KV map
6. **Implement disbursement**: Requires real sandbox payment endpoint

### To Continue Development
- The codebase is structured for incremental improvement
- Each contract function has a clear MVP stub pattern
- The storage format is stable (decimal strings for BigInt)
- The T3N SDK integration follows the v5.2.0 API surface

## Key Files

| File | Purpose |
|------|---------|
| `src/cli.ts` | CLI entry point |
| `src/storage/offline.ts` | Employee/batch persistence |
| `src/t3n/client.ts` | T3N authentication |
| `src/t3n/tenant.ts` | Contract operations |
| `contracts/payroll/src/payroll.rs` | Core computation |
| `contracts/payroll/src/lib.rs` | WASM entry point |
| `.github/workflows/ci.yml` | CI configuration |
