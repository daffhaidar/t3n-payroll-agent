# Submission — T3N Payroll Agent

## Problem

Enterprise payroll requires tamper-proof computation for tax withholding and salary calculation. Traditional systems rely on trust in the operator; T3N TEE provides cryptographic assurance.

## Enterprise Usefulness

- Payroll computation inside TEE ensures no tampering with tax rates or salary calculations
- Batch caps prevent accidental over-payment
- Agent delegation enables automated payroll processing with audit trails
- Checked arithmetic prevents overflow in financial calculations

## Architecture

TypeScript CLI + Rust/WASM contract running inside T3N TEE. Offline mode for testing, live mode for TEE execution.

## TEE Boundary

The WASM contract computes payroll inside the TEE. In the MVP, employee records are passed in the input (visible to the agent). In production, they would be read from a private KV map.

## Threat Model

- TEE ensures computation integrity
- Agent is semi-trusted (provides input, sees output)
- Batch caps enforced in both TypeScript and Rust
- Duplicate employees rejected in both layers

## Setup

```bash
git clone https://github.com/daffhaidar/t3n-payroll-agent.git
cd t3n-payroll-agent
npm ci
```

## Demo Flow

1. Add employees with salary and tax rate
2. Process offline payroll with cycle ID and pay period
3. View batch history and details
4. (Live) Register WASM contract, execute inside TEE

## Verified Results

- 100 TypeScript tests pass
- 24 Rust tests pass
- Clippy zero warnings
- WASM builds successfully for wasm32-wasip2
- CLI smoke test: add → list → process → history → remove

## Known Limitations

- Employee records visible to calling agent (MVP)
- Audit persistence is a stub
- Disbursement not implemented
- No encryption at rest

## Bugs Encountered

1. BigInt serialization crash (fixed: decimal string DTO)
2. CLI --offline required (fixed: optional boolean)
3. TenantClient missing baseUrl (fixed: getNodeUrl())
4. contract_id:0 fabrication (fixed: exit with BLOCKED)
5. MAX_BATCH_CAP constant wrong (fixed: $10M not $1B)

## Maintenance/Handover

See HANDOVER.md for full details. Key actions:
1. Rotate T3N_API_KEY
2. Obtain separate AGENT_KEY
3. Deploy contract version 0.1.1
4. Implement KV map reads for employee privacy

## Does the Author Want to Continue?

Yes, contingent on T3N testnet credits and a production-grade audit trail implementation.

## Repository

https://github.com/daffhaidar/t3n-payroll-agent

## Screenshot Placeholders

BLOCKED — screenshots require a running T3N testnet session with valid credentials.
Human action: capture after rotating keys and running live tests.
