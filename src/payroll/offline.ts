/**
 * Offline payroll computation — runs locally without TEE.
 * Always prints UNSAFE LOCAL DEMO banner.
 * Requires explicit --offline flag to run.
 *
 * Enforces:
 * - Cycle ID in batch identity
 * - Pay period stored in batch
 * - Batch cap enforced
 * - Duplicate employee IDs rejected
 * - Zero salary rejected
 * - Exact BigInt cents and integer basis points
 * - Results labeled as "calculated" (not TEE-validated)
 */

import type { Employee, PayrollBatch, PayrollResult } from "./types.js";
import { calculateTax, calculateNet, ZERO_CENTS } from "../money.js";

export interface OfflinePayrollOptions {
  cycleId: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  batchCapCents: bigint;
}

export function computeOfflinePayroll(
  employees: Employee[],
  tenantDid: string,
  options: OfflinePayrollOptions,
): PayrollBatch {
  console.warn("UNSAFE LOCAL DEMO — NOT EXECUTED IN T3N TEE");

  // Validate: no duplicate employee IDs
  const seenIds = new Set<string>();
  for (const emp of employees) {
    if (seenIds.has(emp.id)) {
      throw new Error(`Duplicate employee ID: ${emp.id}`);
    }
    seenIds.add(emp.id);
  }

  // Validate: no zero salary
  for (const emp of employees) {
    if (emp.baseSalaryCents <= 0n) {
      throw new Error(`Employee ${emp.id} has zero or negative salary`);
    }
  }

  const results: PayrollResult[] = [];
  let totalGross = ZERO_CENTS;
  let totalTax = ZERO_CENTS;
  let totalNet = ZERO_CENTS;

  for (const emp of employees) {
    const tax = calculateTax(emp.baseSalaryCents, emp.taxBasisPoints);
    const net = calculateNet(emp.baseSalaryCents, tax);

    const result: PayrollResult = {
      employeeId: emp.id,
      grossPayCents: emp.baseSalaryCents,
      taxWithheldCents: tax,
      netPayCents: net,
      payDate: new Date().toISOString().split("T")[0]!,
      status: "calculated",
    };

    results.push(result);
    totalGross += emp.baseSalaryCents;
    totalTax += tax;
    totalNet += net;
  }

  // Enforce batch cap
  if (totalNet > options.batchCapCents) {
    throw new Error(
      `Total net pay ${totalNet.toString()} exceeds batch cap ${options.batchCapCents.toString()}`,
    );
  }

  const batchId = `offline-${options.cycleId}-${Date.now()}`;

  return {
    batchId,
    processedAt: new Date().toISOString(),
    tenantDid,
    cycleId: options.cycleId,
    payPeriodStart: options.payPeriodStart,
    payPeriodEnd: options.payPeriodEnd,
    totalEmployees: results.length,
    totalGrossCents: totalGross,
    totalTaxCents: totalTax,
    totalNetCents: totalNet,
    results,
  };
}
