# Security

## Threat Model

The payroll agent operates in a semi-trusted model:

1. **TEE Integrity**: The T3N TEE ensures computation integrity — salary calculations cannot be tampered with during execution
2. **Agent Trust**: The calling agent provides input (employee records, cycle parameters) and receives output. In the MVP, the agent can see salary data
3. **Data at Rest**: Local storage uses JSON files with no encryption (offline mode only)

## Key Management

- `T3N_API_KEY`: Tenant authentication key. Compromised key treated as revoked
- `AGENT_KEY`: Agent authentication key. Must be separate from T3N_API_KEY
- Keys are loaded from environment variables, never hardcoded
- The CLI never prints or logs keys

## Validation Layers

| Layer | Validates |
|-------|-----------|
| TypeScript CLI | Wallet format, employee ID format, salary > 0, tax rate 0-10000, date format, batch cap > 0 |
| Rust WASM contract | Same + employee count <= 1000, no duplicate IDs, end date > start date, checked arithmetic overflow |

## Known Limitations (MVP)

- Employee records visible to calling agent (production: read from private KV map)
- No encryption at rest for local storage
- No rate limiting on CLI operations
- No audit trail persistence (finalize-audit is a stub)
- No disbursement implementation
