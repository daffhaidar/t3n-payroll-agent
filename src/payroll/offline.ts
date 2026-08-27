/**
 * Offline payroll computation — runs locally without TEE.
 * Always prints UNSAFE LOCAL DEMO banner.
 * Requires explicit --offline flag to run.
 */

import type { Employee, PayrollBatch, PayrollResult } from "./types.js";
import { calculateTax, calculateNet, ZERO_CENTS } from "../money.js";

export function computeOfflinePayroll(
  employees: Employee[],
  tenantDid: string,
): PayrollBatch {
  console.warn("UNSAFE LOCAL DEMO — NOT EXECUTED IN T3N TEE");

  const batchId = `batch-${Date.now()}`;
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

  return {
    batchId,
    processedAt: new Date().toISOString(),
    tenantDid,
    totalEmployees: results.length,
    totalGrossCents: totalGross,
    totalTaxCents: totalTax,
    totalNetCents: totalNet,
    results,
  };
}
