import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateWalletAddress,
  validateEmployeeId,
  validateCycleId,
  validatePayPeriod,
  validateBatchCap,
} from "../src/validation.js";

describe("validateWalletAddress", () => {
  it("accepts valid 40-hex address", () => {
    assert.doesNotThrow(() =>
      validateWalletAddress("0x0000000000000000000000000000000000000001"),
    );
  });

  it("accepts mixed-case hex", () => {
    assert.doesNotThrow(() =>
      validateWalletAddress("0xAbCdEf0123456789AbCdEf0123456789AbCdEf01"),
    );
  });

  it("rejects missing 0x prefix", () => {
    assert.throws(() =>
      validateWalletAddress("0000000000000000000000000000000000000001"),
    );
  });

  it("rejects too short address", () => {
    assert.throws(() =>
      validateWalletAddress("0x000000000000000000000000000000000000000"),
    );
  });

  it("rejects too long address", () => {
    assert.throws(() =>
      validateWalletAddress("0x00000000000000000000000000000000000000001"),
    );
  });

  it("rejects non-hex characters", () => {
    assert.throws(() =>
      validateWalletAddress("0x000000000000000000000000000000000000000g"),
    );
  });

  it("rejects empty string", () => {
    assert.throws(() => validateWalletAddress(""));
  });

  it("rejects 'nope'", () => {
    assert.throws(() => validateWalletAddress("nope"));
  });
});

describe("validateEmployeeId", () => {
  it("accepts simple ID", () => {
    assert.doesNotThrow(() => validateEmployeeId("EMP-001"));
  });

  it("accepts underscore", () => {
    assert.doesNotThrow(() => validateEmployeeId("emp_001"));
  });

  it("accepts max length (64)", () => {
    assert.doesNotThrow(() => validateEmployeeId("A".repeat(64)));
  });

  it("rejects empty string", () => {
    assert.throws(() => validateEmployeeId(""));
  });

  it("rejects too long ID (65)", () => {
    assert.throws(() => validateEmployeeId("A".repeat(65)));
  });

  it("rejects special characters", () => {
    assert.throws(() => validateEmployeeId("EMP@001"));
  });

  it("rejects spaces", () => {
    assert.throws(() => validateEmployeeId("EMP 001"));
  });
});

describe("validateCycleId", () => {
  it("accepts simple cycle ID", () => {
    assert.doesNotThrow(() => validateCycleId("cycle-2026-08"));
  });

  it("rejects empty string", () => {
    assert.throws(() => validateCycleId(""));
  });
});

describe("validatePayPeriod", () => {
  it("accepts valid date range", () => {
    assert.doesNotThrow(() =>
      validatePayPeriod("2026-08-01", "2026-08-31"),
    );
  });

  it("rejects end before start", () => {
    assert.throws(() =>
      validatePayPeriod("2026-08-31", "2026-08-01"),
    );
  });

  it("rejects invalid start date", () => {
    assert.throws(() =>
      validatePayPeriod("not-a-date", "2026-08-31"),
    );
  });

  it("rejects invalid end date", () => {
    assert.throws(() =>
      validatePayPeriod("2026-08-01", "not-a-date"),
    );
  });
});

describe("validateBatchCap", () => {
  it("accepts positive cap", () => {
    assert.doesNotThrow(() => validateBatchCap(5000000n));
  });

  it("rejects zero cap", () => {
    assert.throws(() => validateBatchCap(0n), /must be positive/);
  });

  it("rejects negative cap", () => {
    assert.throws(() => validateBatchCap(-1n), /must be positive/);
  });
});
