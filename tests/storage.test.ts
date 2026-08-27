import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Employee, PayrollBatch } from "../src/payroll/types.js";
import {
  saveEmployees,
  loadEmployees,
  saveBatch,
  loadBatch,
  listBatchIds,
} from "../src/storage/offline.js";

/**
 * Storage tests — uses isolated temp directories via PAYROLL_DATA_DIR env var.
 * The storage module reads PAYROLL_DATA_DIR at call time, so setting the env
 * var before each test is sufficient. NEVER writes to the repo's real .payroll.
 */

let tmpDir: string;

function setupTmpDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "payroll-test-"));
  process.env["PAYROLL_DATA_DIR"] = tmpDir;
}

function cleanupTmpDir() {
  delete process.env["PAYROLL_DATA_DIR"];
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

const TEST_EMPLOYEE: Employee = {
  id: "EMP-TEST-001",
  name: "Alice Test",
  walletAddress: "0x0000000000000000000000000000000000000001",
  baseSalaryCents: 500000n,
  department: "Engineering",
  taxBasisPoints: 2000,
};

const TEST_EMPLOYEE_2: Employee = {
  id: "EMP-TEST-002",
  name: "Bob Test",
  walletAddress: "0x0000000000000000000000000000000000000002",
  baseSalaryCents: 420000n,
  department: "Design",
  taxBasisPoints: 1800,
};

describe("Employee storage BigInt round trip", () => {
  beforeEach(() => setupTmpDir());
  afterEach(() => cleanupTmpDir());

  it("saves and loads employees with correct BigInt values", () => {
    const employees = [TEST_EMPLOYEE, TEST_EMPLOYEE_2];
    saveEmployees(employees);

    const loaded = loadEmployees();
    assert.equal(loaded.length, 2);
    assert.equal(loaded[0]!.id, "EMP-TEST-001");
    assert.equal(loaded[0]!.name, "Alice Test");
    assert.equal(loaded[0]!.baseSalaryCents, 500000n);
    assert.equal(loaded[0]!.taxBasisPoints, 2000);
    assert.equal(loaded[1]!.id, "EMP-TEST-002");
    assert.equal(loaded[1]!.baseSalaryCents, 420000n);
  });

  it("on-disk file has string values, not raw bigint", () => {
    saveEmployees([TEST_EMPLOYEE]);

    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, "employees.json"), "utf-8"));
    assert.equal(typeof raw[0].baseSalaryCents, "string");
    assert.equal(raw[0].baseSalaryCents, "500000");
    assert.equal(typeof raw[0].taxBasisPoints, "number");
  });

  it("returns empty array when no file exists", () => {
    const loaded = loadEmployees();
    assert.equal(loaded.length, 0);
  });
});

describe("Corrupted storage rejection", () => {
  beforeEach(() => setupTmpDir());
  afterEach(() => cleanupTmpDir());

  it("rejects invalid JSON", () => {
    fs.writeFileSync(path.join(tmpDir, "employees.json"), "not json!!!");
    assert.throws(() => loadEmployees(), /invalid JSON/);
  });

  it("rejects non-array JSON", () => {
    fs.writeFileSync(path.join(tmpDir, "employees.json"), '{"not": "array"}');
    assert.throws(() => loadEmployees(), /expected array/);
  });

  it("rejects employee with missing baseSalaryCents string", () => {
    fs.writeFileSync(
      path.join(tmpDir, "employees.json"),
      JSON.stringify([{ id: "X", name: "Y", walletAddress: "0x" + "0".repeat(40), baseSalaryCents: 123, department: "D", taxBasisPoints: 100 }]),
    );
    assert.throws(() => loadEmployees(), /baseSalaryCents must be a string/);
  });

  it("rejects employee with non-integer taxBasisPoints", () => {
    fs.writeFileSync(
      path.join(tmpDir, "employees.json"),
      JSON.stringify([{ id: "X", name: "Y", walletAddress: "0x" + "0".repeat(40), baseSalaryCents: "100", department: "D", taxBasisPoints: 10.5 }]),
    );
    assert.throws(() => loadEmployees(), /taxBasisPoints must be an integer/);
  });
});

describe("Duplicate employees", () => {
  beforeEach(() => setupTmpDir());
  afterEach(() => cleanupTmpDir());

  it("allows saving employees with duplicate IDs (CLI catches this)", () => {
    const dupes = [TEST_EMPLOYEE, { ...TEST_EMPLOYEE, name: "Duplicate" }];
    saveEmployees(dupes);
    const loaded = loadEmployees();
    assert.equal(loaded.length, 2);
  });
});

describe("Batch save/load round trip", () => {
  beforeEach(() => setupTmpDir());
  afterEach(() => cleanupTmpDir());

  it("saves and loads batch with correct BigInt values", () => {
    const batch: PayrollBatch = {
      batchId: "test-batch-001",
      processedAt: "2026-08-27T00:00:00Z",
      tenantDid: "offline",
      cycleId: "cycle-test",
      payPeriodStart: "2026-08-01",
      payPeriodEnd: "2026-08-31",
      totalEmployees: 1,
      totalGrossCents: 500000n,
      totalTaxCents: 100000n,
      totalNetCents: 400000n,
      results: [
        {
          employeeId: "EMP-TEST-001",
          grossPayCents: 500000n,
          taxWithheldCents: 100000n,
          netPayCents: 400000n,
          payDate: "2026-08-27",
          status: "calculated",
        },
      ],
    };

    saveBatch(batch);
    const ids = listBatchIds();
    assert.ok(ids.includes("test-batch-001"));

    const loaded = loadBatch("test-batch-001");
    assert.ok(loaded);
    assert.equal(loaded.totalGrossCents, 500000n);
    assert.equal(loaded.totalTaxCents, 100000n);
    assert.equal(loaded.totalNetCents, 400000n);
    assert.equal(loaded.cycleId, "cycle-test");
    assert.equal(loaded.payPeriodStart, "2026-08-01");
    assert.equal(loaded.payPeriodEnd, "2026-08-31");
    assert.equal(loaded.results[0]!.grossPayCents, 500000n);
    assert.equal(loaded.results[0]!.netPayCents, 400000n);
  });

  it("returns null for non-existent batch", () => {
    const batch = loadBatch("non-existent");
    assert.equal(batch, null);
  });
});
