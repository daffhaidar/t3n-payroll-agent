import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  parseDollarsToCents,
  parseCentsString,
  parseBasisPoints,
  calculateTax,
  calculateNet,
  formatDollars,
  centsToWireString,
  centsFromString,
  ZERO_CENTS,
} from "../src/money.js";

describe("parseDollarsToCents", () => {
  it("parses simple integer dollars", () => {
    assert.equal(parseDollarsToCents("5000"), 500000n);
  });

  it("parses dollars with cents", () => {
    assert.equal(parseDollarsToCents("5000.50"), 500050n);
  });

  it("parses zero", () => {
    assert.equal(parseDollarsToCents("0"), 0n);
  });

  it("parses zero with decimals", () => {
    assert.equal(parseDollarsToCents("0.00"), 0n);
  });

  it("parses single decimal digit", () => {
    assert.equal(parseDollarsToCents("100.5"), 10050n);
  });

  it("rejects negative values", () => {
    assert.throws(() => parseDollarsToCents("-100"), /negative values not allowed/);
  });

  it("rejects values with more than two fractional digits", () => {
    assert.throws(() => parseDollarsToCents("100.123"), /more than two fractional digits/);
  });

  it("rejects scientific notation", () => {
    assert.throws(() => parseDollarsToCents("1e5"), /scientific notation not allowed/);
  });

  it("rejects NaN", () => {
    assert.throws(() => parseDollarsToCents("NaN"), /NaN\/Infinity not allowed/);
  });

  it("rejects Infinity", () => {
    assert.throws(() => parseDollarsToCents("Infinity"), /NaN\/Infinity not allowed/);
  });

  it("rejects empty string", () => {
    assert.throws(() => parseDollarsToCents(""), /Empty monetary value/);
  });

  it("rejects whitespace-only string", () => {
    assert.throws(() => parseDollarsToCents("   "), /Empty monetary value/);
  });

  it("rejects non-numeric characters", () => {
    assert.throws(() => parseDollarsToCents("abc"), /non-numeric characters/);
  });

  it("rejects multiple decimal points", () => {
    assert.throws(() => parseDollarsToCents("1.2.3"), /multiple decimal points/);
  });

  it("rejects positive sign", () => {
    assert.throws(() => parseDollarsToCents("+100"), /negative values not allowed/);
  });
});

describe("centsFromString", () => {
  it("parses valid cents string", () => {
    assert.equal(centsFromString("500000"), 500000n);
  });

  it("parses zero", () => {
    assert.equal(centsFromString("0"), 0n);
  });

  it("rejects empty string", () => {
    assert.throws(() => centsFromString(""), /Empty cents value/);
  });

  it("rejects negative", () => {
    assert.throws(() => centsFromString("-100"), /must be non-negative integer/);
  });

  it("rejects decimal", () => {
    assert.throws(() => centsFromString("100.50"), /must be non-negative integer/);
  });

  it("rejects non-numeric", () => {
    assert.throws(() => centsFromString("abc"), /must be non-negative integer/);
  });
});

describe("parseBasisPoints", () => {
  it("parses 0 basis points (0%)", () => {
    assert.equal(parseBasisPoints("0"), 0);
  });

  it("parses 2000 basis points (20%)", () => {
    assert.equal(parseBasisPoints("2000"), 2000);
  });

  it("parses 10000 basis points (100%)", () => {
    assert.equal(parseBasisPoints("10000"), 10000);
  });

  it("rejects negative basis points", () => {
    assert.throws(() => parseBasisPoints("-1"), /must be non-negative integer/);
  });

  it("rejects basis points over 10000", () => {
    assert.throws(() => parseBasisPoints("20000"), /must be between 0 and 10000/);
  });

  it("rejects non-numeric input", () => {
    assert.throws(() => parseBasisPoints("abc"), /must be non-negative integer/);
  });

  it("rejects empty string", () => {
    assert.throws(() => parseBasisPoints(""), /Empty tax rate value/);
  });
});

describe("calculateTax", () => {
  it("calculates 20% tax on $5000", () => {
    const tax = calculateTax(500000n, 2000);
    assert.equal(tax, 100000n);
  });

  it("calculates 0% tax", () => {
    const tax = calculateTax(500000n, 0);
    assert.equal(tax, 0n);
  });

  it("calculates 100% tax", () => {
    const tax = calculateTax(500000n, 10000);
    assert.equal(tax, 500000n);
  });
});

describe("calculateNet", () => {
  it("calculates net = gross - tax", () => {
    const net = calculateNet(500000n, 100000n);
    assert.equal(net, 400000n);
  });
});

describe("formatDollars", () => {
  it("formats zero", () => {
    assert.equal(formatDollars(0n), "0.00");
  });

  it("formats whole dollars", () => {
    assert.equal(formatDollars(500000n), "5000.00");
  });

  it("formats dollars with cents", () => {
    assert.equal(formatDollars(500050n), "5000.50");
  });

  it("formats single cent", () => {
    assert.equal(formatDollars(1n), "0.01");
  });
});

describe("centsToWireString", () => {
  it("converts bigint to string", () => {
    assert.equal(centsToWireString(500000n), "500000");
  });
});
