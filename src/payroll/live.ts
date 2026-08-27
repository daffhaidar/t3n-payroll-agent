/**
 * Live TEE payroll execution — calls real T3N contract functions.
 *
 * This module delegates to the canonical tenant.ts for contract execution.
 * It provides higher-level payroll-specific helpers.
 *
 * NOTE: The canonical contract execution is in src/t3n/tenant.ts.
 * Do not add duplicate execution logic here.
 */

import type { TenantClient } from "@terminal3/t3n-sdk";
import { getContractVersion, getNodeUrl } from "@terminal3/t3n-sdk";
import type { PayrollBatch, PayrollResult, TeePayrollComputeResult } from "./types.js";

const PAYROLL_CONTRACT_TAIL = "payroll";
const PAYROLL_VERSION = "0.1.0";

export interface LivePayrollDeps {
  tenant: TenantClient;
  tenantDid: string;
}

/**
 * Build the canonical contract script name: z:<tid>:payroll
 */
function getScriptName(tenantDid: string): string {
  const tid = tenantDid.replace("did:t3n:", "");
  return `z:${tid}:${PAYROLL_CONTRACT_TAIL}`;
}

/**
 * Compute payroll for employees via TEE.
 * Calls the "compute-payroll" function on the registered payroll contract.
 */
export async function computePayrollInTee(
  deps: LivePayrollDeps,
  cycleId: string,
  payPeriodStart: string,
  payPeriodEnd: string,
  batchCapCents: bigint,
): Promise<PayrollBatch> {
  const nodeUrl = getNodeUrl();
  const scriptName = getScriptName(deps.tenantDid);

  // Resolve contract version from the node
  let scriptVersion: string;
  try {
    scriptVersion = await getContractVersion(nodeUrl, scriptName);
  } catch (err) {
    throw new Error(
      `Failed to resolve contract version for ${scriptName}. ` +
      `Is the payroll contract registered? Error: ${err}`,
    );
  }

  // Execute inside TEE
  const result = await deps.tenant.contracts.execute(PAYROLL_CONTRACT_TAIL, {
    version: scriptVersion,
    functionName: "compute-payroll",
    input: {
      cycle_id: cycleId,
      pay_period_start: payPeriodStart,
      pay_period_end: payPeriodEnd,
      batch_cap_cents: batchCapCents.toString(),
    },
  }) as TeePayrollComputeResult;

  // Parse TEE response into PayrollBatch
  const results: PayrollResult[] = result.employee_results.map((er) => ({
    employeeId: er.employee_id,
    grossPayCents: BigInt(er.gross_pay_cents),
    taxWithheldCents: BigInt(er.tax_withheld_cents),
    netPayCents: BigInt(er.net_pay_cents),
    payDate: new Date().toISOString().split("T")[0]!,
    status: "validated" as const,
  }));

  return {
    batchId: `tee-batch-${result.cycle_id}`,
    processedAt: new Date().toISOString(),
    tenantDid: deps.tenantDid,
    cycleId: result.cycle_id,
    payPeriodStart,
    payPeriodEnd,
    totalEmployees: results.length,
    totalGrossCents: BigInt(result.batch_totals.total_gross_cents),
    totalTaxCents: BigInt(result.batch_totals.total_tax_cents),
    totalNetCents: BigInt(result.batch_totals.total_net_cents),
    results,
  };
}

/**
 * Validate payroll credentials inside TEE.
 * NOTE: validate-credentials only returns true for non-empty cycle_id.
 * It does NOT perform real credential validation — it's an MVP stub.
 */
export async function validateCredentialsInTee(
  deps: LivePayrollDeps,
  cycleId: string,
): Promise<boolean> {
  const nodeUrl = getNodeUrl();
  const scriptName = getScriptName(deps.tenantDid);
  const scriptVersion = await getContractVersion(nodeUrl, scriptName);

  const result = await deps.tenant.contracts.execute(PAYROLL_CONTRACT_TAIL, {
    version: scriptVersion,
    functionName: "validate-credentials",
    input: { cycle_id: cycleId },
  }) as { valid: boolean };

  return result.valid;
}

/**
 * Execute disbursement inside TEE.
 * NOTE: NOT IMPLEMENTED. The contract returns an explicit error.
 */
export async function executeDisbursementInTee(
  deps: LivePayrollDeps,
  cycleId: string,
  batchCapCents: bigint,
): Promise<unknown> {
  const nodeUrl = getNodeUrl();
  const scriptName = getScriptName(deps.tenantDid);
  const scriptVersion = await getContractVersion(nodeUrl, scriptName);

  return deps.tenant.contracts.execute(PAYROLL_CONTRACT_TAIL, {
    version: scriptVersion,
    functionName: "execute-disbursement",
    input: {
      cycle_id: cycleId,
      batch_cap_cents: batchCapCents.toString(),
    },
  });
}

/**
 * List audit cycles from TEE.
 * NOTE: MVP stub — always returns empty array.
 */
export async function listAuditCyclesInTee(
  deps: LivePayrollDeps,
): Promise<Array<{ cycle_id: string; processed_at: string; status: string }>> {
  const nodeUrl = getNodeUrl();
  const scriptName = getScriptName(deps.tenantDid);
  const scriptVersion = await getContractVersion(nodeUrl, scriptName);

  const result = await deps.tenant.contracts.execute(PAYROLL_CONTRACT_TAIL, {
    version: scriptVersion,
    functionName: "list-audit-cycles",
    input: {},
  }) as { cycles: Array<{ cycle_id: string; processed_at: string; status: string }> };

  return result.cycles;
}
