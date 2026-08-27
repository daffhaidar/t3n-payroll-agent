/**
 * Input validation for payroll data.
 */

const WALLET_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const EMPLOYEE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const CYCLE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function validateWalletAddress(address: string): void {
  if (!WALLET_ADDRESS_RE.test(address)) {
    throw new Error(
      `Invalid wallet address "${address}": must be 0x followed by exactly 40 hex characters`,
    );
  }
}

export function validateEmployeeId(id: string): void {
  if (!EMPLOYEE_ID_RE.test(id)) {
    throw new Error(
      `Invalid employee ID "${id}": must be 1-64 characters of alphanumeric, hyphens, or underscores`,
    );
  }
}

export function validateCycleId(id: string): void {
  if (!CYCLE_ID_RE.test(id)) {
    throw new Error(
      `Invalid cycle ID "${id}": must be 1-64 characters of alphanumeric, hyphens, or underscores`,
    );
  }
}

export function validatePayPeriod(start: string, end: string): void {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime())) {
    throw new Error(`Invalid pay_period_start "${start}": not a valid date`);
  }
  if (isNaN(endDate.getTime())) {
    throw new Error(`Invalid pay_period_end "${end}": not a valid date`);
  }
  if (endDate <= startDate) {
    throw new Error("pay_period_end must be after pay_period_start");
  }
}

export function validateBatchCap(batchCapCents: bigint): void {
  if (batchCapCents <= 0n) {
    throw new Error(`batch_cap_cents must be positive, got ${batchCapCents.toString()}`);
  }
}
