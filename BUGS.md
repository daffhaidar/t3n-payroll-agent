# Known Bugs and Limitations

## Fixed in This Branch

1. **BigInt serialization crash**: `JSON.stringify` cannot serialize BigInt. Fixed by storing as decimal strings in EmployeeDTO
2. **CLI --offline requiredOption**: Made `--offline` optional boolean so live mode is reachable
3. **Offline path ignores arguments**: Now uses cycle ID, pay period, and batch cap
4. **TenantClient missing baseUrl**: Added `getNodeUrl()` to TenantClient config
5. **Duplicate execution paths**: Consolidated to single canonical path in tenant.ts
6. **contract_id:0 fabrication**: Removed sentinel fallback on version-exists error
7. **MAX_BATCH_CAP_CENTS wrong**: Corrected from 100B ($1B) to 1B ($10M)
8. **execSync with interpolated secrets**: Replaced with execFileSync + env object

## Remaining MVP Limitations

| Issue | Severity | Status |
|-------|----------|--------|
| Employee records visible to agent | Medium | MVP design (production: KV map) |
| finalize-audit does not persist | Low | MVP stub |
| validate-credentials returns true for non-empty ID | Low | MVP stub |
| list-audit-cycles returns empty array | Low | MVP stub |
| No disbursement implementation | High | Explicit NOT IMPLEMENTED error |
| No encryption at rest | Low | Offline mode only |
