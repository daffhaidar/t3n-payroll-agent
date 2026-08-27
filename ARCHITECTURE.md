# Architecture

## Overview

The T3N Payroll Agent is a TypeScript + Rust/WASM application that computes payroll inside a Terminal 3 TEE.

## Components

### TypeScript Layer

- **CLI** (`src/cli.ts`): Commander-based CLI with add/list/remove/process/history/show commands
- **Storage** (`src/storage/offline.ts`): JSON file storage with BigInt-as-string serialization and atomic writes
- **Money** (`src/money.ts`): Exact BigInt monetary arithmetic (cents + basis points)
- **Validation** (`src/validation.ts`): Input validation for wallets, employee IDs, cycle IDs, pay periods, batch caps
- **Config** (`src/config.ts`): Environment loading with AGENT_KEY separation enforcement
- **T3N Client** (`src/t3n/client.ts`): Authentication and TenantClient creation with baseUrl
- **T3N Tenant** (`src/t3n/tenant.ts`): Canonical contract registration and execution
- **Payroll Types** (`src/payroll/types.ts`): Runtime types + on-disk DTOs with decimal string serialization
- **Offline Payroll** (`src/payroll/offline.ts`): Local computation with cycle/period/cap enforcement
- **Live Payroll** (`src/payroll/live.ts`): TEE execution via tenant.contracts.execute()

### Rust/WASM Layer

- **Contract** (`contracts/payroll/src/lib.rs`): WIT component with 6 exported functions
- **Payroll Logic** (`contracts/payroll/src/payroll.rs`): Core computation with checked arithmetic
- **Audit** (`contracts/payroll/src/audit.rs`): Audit record management (MVP stubs)

## Data Flow

### Offline Mode
```
CLI → loadEmployees() → computeOfflinePayroll() → saveBatch() → printSummary()
```

### Live Mode
```
CLI → connectToT3n() → executePayrollFunction() → tenant.contracts.execute()
  → WASM compute_payroll() → response parsed → saveBatch() → printSummary()
```

## Storage Format

Employees are stored as JSON with `baseSalaryCents` as a decimal string:
```json
[{
  "id": "EMP-001",
  "name": "Alice",
  "walletAddress": "0x...",
  "baseSalaryCents": "500000",
  "department": "Engineering",
  "taxBasisPoints": 2000
}]
```

Batches are stored similarly with all bigint fields as strings.

## Security Boundaries

- **WASM contract**: Validates all inputs (cycle ID, dates, employee count, salaries, tax rates)
- **TypeScript CLI**: Validates inputs before passing to storage or contract
- **Atomic writes**: temp file + rename prevents corruption
- **Key separation**: T3N_API_KEY (tenant) vs AGENT_KEY (agent) enforced at config load
