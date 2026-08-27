/**
 * Exact monetary arithmetic using bigint cents.
 *
 * All monetary values on the JSON wire are decimal strings in cents (e.g. "150000" = $1,500.00).
 * Internally we use bigint. Tax is represented as integer basis points (0–10000).
 *
 * Rules:
 * - Negative values rejected
 * - Maximum two fractional digits
 * - NaN/Infinity/scientific notation rejected
 * - Empty values rejected
 */

export type Cents = bigint;
export type BasisPoints = number; // 0–10000 inclusive

export const ZERO_CENTS: Cents = 0n;

/**
 * Parse a decimal dollar string (e.g. "5000.00") into cents (bigint).
 * Rejects negative values, >2 fractional digits, NaN, Infinity, scientific notation, empty.
 */
export function parseDollarsToCents(input: string): Cents {
  const trimmed = input.trim();
  if (trimmed.length === 0) throw new Error("Empty monetary value");

  // Reject scientific notation
  if (/[eE]/.test(trimmed)) {
    throw new Error(`Invalid monetary value "${trimmed}": scientific notation not allowed`);
  }

  // Reject NaN/Infinity literals
  if (trimmed === "NaN" || trimmed === "Infinity" || trimmed === "-Infinity") {
    throw new Error(`Invalid monetary value "${trimmed}": NaN/Infinity not allowed`);
  }

  // Reject negative
  if (trimmed.startsWith("-") || trimmed.startsWith("+")) {
    throw new Error(`Invalid monetary value "${trimmed}": negative values not allowed`);
  }

  const parts = trimmed.split(".");
  if (parts.length > 2) {
    throw new Error(`Invalid monetary value "${trimmed}": multiple decimal points`);
  }

  const integerPart = parts[0]!;
  const fractionalPart = parts[1];

  if (!/^\d+$/.test(integerPart)) {
    throw new Error(`Invalid monetary value "${trimmed}": non-numeric characters`);
  }

  if (fractionalPart !== undefined) {
    if (fractionalPart.length > 2) {
      throw new Error(
        `Invalid monetary value "${trimmed}": more than two fractional digits`,
      );
    }
    if (!/^\d+$/.test(fractionalPart)) {
      throw new Error(`Invalid monetary value "${trimmed}": non-numeric fractional part`);
    }
  }

  const cents = fractionalPart
    ? BigInt(integerPart) * 100n + BigInt(fractionalPart.padEnd(2, "0"))
    : BigInt(integerPart) * 100n;

  return cents;
}

/**
 * Parse a cents string (e.g. "500000") directly to bigint.
 * Used for historical_baselines which are already in cents.
 */
export function parseCentsString(input: string): Cents {
  const trimmed = input.trim();
  if (trimmed.length === 0) throw new Error("Empty cents value");
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid cents value "${trimmed}": must be non-negative integer`);
  }
  return BigInt(trimmed);
}

/**
 * Parse a basis points string (e.g. "2000" for 20%).
 * Must be integer between 0 and 10000 inclusive.
 */
export function parseBasisPoints(input: string): BasisPoints {
  const trimmed = input.trim();
  if (trimmed.length === 0) throw new Error("Empty tax rate value");
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid tax rate "${trimmed}": must be non-negative integer basis points`);
  }
  const bp = parseInt(trimmed, 10);
  if (bp < 0 || bp > 10000) {
    throw new Error(`Invalid tax rate "${trimmed}": must be between 0 and 10000 basis points (0-100%)`);
  }
  return bp;
}

/**
 * Calculate tax withheld: gross * basisPoints / 10000
 */
export function calculateTax(gross: Cents, basisPoints: BasisPoints): Cents {
  return (gross * BigInt(basisPoints)) / 10000n;
}

/**
 * Calculate net pay: gross - tax
 */
export function calculateNet(gross: Cents, tax: Cents): Cents {
  return gross - tax;
}

/**
 * Format cents as a dollar string for display (e.g. 500000n → "5000.00").
 */
export function formatDollars(cents: Cents): string {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  const dollars = abs / 100n;
  const remainder = abs % 100n;
  return `${sign}${dollars}.${remainder.toString().padStart(2, "0")}`;
}

/**
 * Convert cents to a decimal string for JSON wire format.
 */
export function centsToWireString(cents: Cents): string {
  return cents.toString();
}

/**
 * Parse a validated decimal string back to bigint cents.
 * Rejects non-numeric, negative, or empty values.
 */
export function centsFromString(input: string): Cents {
  const trimmed = input.trim();
  if (trimmed.length === 0) throw new Error("Empty cents value");
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid cents string "${trimmed}": must be non-negative integer`);
  }
  return BigInt(trimmed);
}
