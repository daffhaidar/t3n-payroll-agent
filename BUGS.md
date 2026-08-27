# Known Bugs and Blockers

## BUG-001: Contract Registration — SDK 5.2.0

| Field | Value |
|-------|-------|
| **Date** | 2026-08-27 |
| **SDK Version** | @terminal3/t3n-sdk 5.2.0 |
| **Node Version** | v22.22.3 |
| **npm Version** | 10.9.8 |
| **Cluster** | testnet |
| **Status** | RESOLVED |

### Resolution
Registration **works** with SDK 5.2.0. The key fix was adding `baseUrl: nodeUrl` to the `TenantClient` config. Without it, the error was:
```
TenantClient.contracts.register requires config field(s): baseUrl
```

### Initial Error (Fixed)
First attempt failed because `TenantClient` was created without `baseUrl`. After adding `baseUrl: nodeUrl`, registration succeeded:
```
name:        z:f5edef51b04ce7cfa92262bb0f0c801c957fb25c:payroll
contract_id: 754
```

### Subsequent Runs
Re-registration of the same version fails with expected error:
```
contract version invalid: version 0.1.0 is not higher than current version 0.1.0
```
This is correct behavior — version must be bumped for re-registration.

---

## BUG-002: wasm-tools Install Timeout

| Field | Value |
|-------|-------|
| **Date** | 2026-08-27 |
| **Tool** | wasm-tools (cargo install) |
| **Status** | KNOWN LIMITATION |

### Description
`cargo install wasm-tools` times out after 300 seconds on t3.small instance.

### Impact
LOW — WASM builds and tests pass without it.

### Workaround
Skip `wasm-tools component wit` verification.
