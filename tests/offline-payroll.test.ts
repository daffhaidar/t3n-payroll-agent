import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeOfflinePayroll } from "../src/payroll/offline.js";
import type { Employee } from "../src/payroll/types.js";

const TEST_EMPLOYEES: Employee[] = [
  {
    id: "EMP-001",
    walletAddress: "0x0000000000000000000000000000000000000001",
    baseSalaryCents: 500000n, // $5000
    department: "Engineering",
    taxBasisPoints: 2000, // 20%
  },
  {
    id: "EMP-002",
    walletAddress: "0x0000000000000000000000000000000000000002",
    baseSalaryCents: 420000n, // $4200
    department: "Design",
    taxBasisPoints: 1800, // 18%
  },
];

describe("computeOfflinePayroll", () => {
  it("computes payroll for multiple employees", () => {
    const batch = computeOfflinePayroll(TEST_EMPLOYEES, "offline");

    assert.equal(batch.totalEmployees, 2);
    assert.equal(batch.tenantDid, "offline");

    // EMP-001: $5000 * 20% = $1000 tax, $4000 net
    assert.equal(batch.results[0]!.grossPayCents, 500000n);
    assert.equal(batch.results[0]!.taxWithheldCents, 100000n);
    assert.equal(batch.results[0]!.netPayCents, 400000n);
    assert.equal(batch.results[0]!.status, "calculated");

    // EMP-002: $4200 * 18% = $756 tax, $3444 net
    assert.equal(batch.results[1]!.grossPayCents, 420000n);
    assert.equal(batch.results[1]!.taxWithheldCents, 75600n);
    assert.equal(batch.results[1]!.netPayCents, 344400n);
    assert.equal(batch.results[1]!.status, "calculated");

    // Totals
    assert.equal(batch.totalGrossCents, 920000n);
    assert.equal(batch.totalTaxCents, 175600n);
    assert.equal(batch.totalNetCents, 744400n);
  });

  it("has batchId and processedAt", () => {
    const batch = computeOfflinePayroll(TEST_EMPLOYEES, "offline");
    assert.ok(batch.batchId.startsWith("batch-"));
    assert.ok(batch.processedAt.length > 0);
  });

  it("handles single employee", () => {
    const batch = computeOfflinePayroll([TEST_EMPLOYEES[0]!], "offline");
    assert.equal(batch.totalEmployees, 1);
    assert.equal(batch.totalGrossCents, 500000n);
  });
});
