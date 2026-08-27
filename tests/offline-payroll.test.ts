import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { computeOfflinePayroll } from "../src/payroll/offline.js";
import type { Employee } from "../src/payroll/types.js";

const TEST_EMPLOYEES: Employee[] = [
  {
    id: "EMP-001",
    name: "Alice",
    walletAddress: "0x0000000000000000000000000000000000000001",
    baseSalaryCents: 500000n, // $5000
    department: "Engineering",
    taxBasisPoints: 2000, // 20%
  },
  {
    id: "EMP-002",
    name: "Bob",
    walletAddress: "0x0000000000000000000000000000000000000002",
    baseSalaryCents: 420000n, // $4200
    department: "Design",
    taxBasisPoints: 1800, // 18%
  },
];

const DEFAULT_OPTIONS = {
  cycleId: "cycle-test-001",
  payPeriodStart: "2026-08-01",
  payPeriodEnd: "2026-08-31",
  batchCapCents: 1_000_000_000n,
};

describe("computeOfflinePayroll", () => {
  it("computes payroll for multiple employees", () => {
    const batch = computeOfflinePayroll(TEST_EMPLOYEES, "offline", DEFAULT_OPTIONS);

    assert.equal(batch.totalEmployees, 2);
    assert.equal(batch.tenantDid, "offline");
    assert.equal(batch.cycleId, "cycle-test-001");
    assert.equal(batch.payPeriodStart, "2026-08-01");
    assert.equal(batch.payPeriodEnd, "2026-08-31");

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
    const batch = computeOfflinePayroll(TEST_EMPLOYEES, "offline", DEFAULT_OPTIONS);
    assert.ok(batch.batchId.startsWith("offline-cycle-test-001-"));
    assert.ok(batch.processedAt.length > 0);
  });

  it("handles single employee", () => {
    const batch = computeOfflinePayroll([TEST_EMPLOYEES[0]!], "offline", DEFAULT_OPTIONS);
    assert.equal(batch.totalEmployees, 1);
    assert.equal(batch.totalGrossCents, 500000n);
  });

  it("preserves cycle ID in batch", () => {
    const options = { ...DEFAULT_OPTIONS, cycleId: "my-custom-cycle" };
    const batch = computeOfflinePayroll(TEST_EMPLOYEES, "offline", options);
    assert.equal(batch.batchId, "offline-my-custom-cycle-" + batch.batchId.split("-").pop());
    assert.equal(batch.cycleId, "my-custom-cycle");
  });

  it("preserves pay period in batch", () => {
    const options = {
      ...DEFAULT_OPTIONS,
      payPeriodStart: "2026-09-01",
      payPeriodEnd: "2026-09-30",
    };
    const batch = computeOfflinePayroll(TEST_EMPLOYEES, "offline", options);
    assert.equal(batch.payPeriodStart, "2026-09-01");
    assert.equal(batch.payPeriodEnd, "2026-09-30");
  });

  it("rejects duplicate employee IDs", () => {
    const dupes: Employee[] = [
      { ...TEST_EMPLOYEES[0]!, name: "Alice" },
      { ...TEST_EMPLOYEES[0]!, name: "Alice Clone" },
    ];
    assert.throws(
      () => computeOfflinePayroll(dupes, "offline", DEFAULT_OPTIONS),
      /Duplicate employee ID/,
    );
  });

  it("rejects zero salary", () => {
    const zeroSalary: Employee[] = [
      { ...TEST_EMPLOYEES[0]!, name: "Zero", baseSalaryCents: 0n },
    ];
    assert.throws(
      () => computeOfflinePayroll(zeroSalary, "offline", DEFAULT_OPTIONS),
      /zero or negative salary/,
    );
  });

  it("rejects negative salary", () => {
    const negSalary: Employee[] = [
      { ...TEST_EMPLOYEES[0]!, name: "Neg", baseSalaryCents: -100n },
    ];
    assert.throws(
      () => computeOfflinePayroll(negSalary, "offline", DEFAULT_OPTIONS),
      /zero or negative salary/,
    );
  });

  it("enforces batch cap", () => {
    const smallCap = { ...DEFAULT_OPTIONS, batchCapCents: 100n }; // $1.00 cap
    assert.throws(
      () => computeOfflinePayroll(TEST_EMPLOYEES, "offline", smallCap),
      /exceeds batch cap/,
    );
  });

  it("uses exact BigInt cents and integer basis points", () => {
    const emp: Employee[] = [
      {
        id: "EMP-BIG",
        name: "Big",
        walletAddress: "0x0000000000000000000000000000000000000001",
        baseSalaryCents: 123456789n,
        department: "Test",
        taxBasisPoints: 1500,
      },
    ];
    const batch = computeOfflinePayroll(emp, "offline", DEFAULT_OPTIONS);
    // 123456789 * 1500 / 10000 = 18518518 (truncated)
    assert.equal(batch.results[0]!.taxWithheldCents, 18518518n);
    assert.equal(batch.results[0]!.netPayCents, 104938271n);
  });
});
