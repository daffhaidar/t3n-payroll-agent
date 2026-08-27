/**
 * Live TEE payroll execution — calls real T3N contract functions.
 *
 * Flow:
 * 1. Connect to T3N testnet (authenticated session)
 * 2. Create TenantClient with authenticated t3n client
 * 3. Call tenant.contracts.execute("compute-payroll", ...) inside TEE
 * 4. Parse TEE response into PayrollBatch
 *
 * Requires:
 * - Registered payroll contract (tenant.contracts.register)
 * - Authenticated session with valid tenantDid
 */

import type { T3nClient } from "@terminal3/t3n-sdk";
import { getContractVersion, getNodeUrl } from "@terminal3/t3n-sdk";
import type { Employee, PayrollBatch, PayrollResult, TeePayrollRequest } from "./types.js";
import { ZERO_CENTS, centsToWireString } from "../money.js";

const PAYROLL_CONTRACT_TAIL = "payroll";
const PAYROLL_VERSION = "0.1.0";

export interface LivePayrollDeps {
  t3n: T3nClient;
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
  employees: Employee[],
  cycleId: string,
  payPeriodStart: string,
  payPeriodEnd: string,
  batchCapCents: bigint,
  historicalBaselines: Record<string, string> = {},
): Promise<PayrollBatch> {
  const scriptName = getScriptName(deps.tenantDid);

  // Resolve contract version from the node
  let scriptVersion: string;
  try {
    scriptVersion = await getContractVersion(getNodeUrl(), scriptName);
  } catch (err) {
    throw new Error(
      `Failed to resolve contract version for ${scriptName}. ` +
      `Is the payroll contract registered? Error: ${err}`,
    );
  }

  const request: TeePayrollRequest = {
    org_id: deps.tenantDid,
    cycle_id: cycleId,
    pay_period_start: payPeriodStart,
    pay_period_end: payPeriodEnd,
    batch_cap_cents: batchCapCents,
    historical_baselines: historicalBaselines,
  };

  // Execute inside TEE
  const result = await deps.t3n.executeAndDecode<{
    cycle_id: string;
    employee_results: Array<{
      employee_id: string;
      gross_pay_cents: string;
      tax_withheld_cents: string;
      net_pay_cents: string;
      status: string;
    }>;
    batch_totals: {
      total_gross_cents: string;
      total_tax_cents: string;
      total_net_cents: string;
    };
  }>({
    contract_id: scriptName,
    contract_version: scriptVersion,
    function_name: "compute-payroll",
    input: { request },
  });

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
    totalEmployees: results.length,
    totalGrossCents: BigInt(result.batch_totals.total_gross_cents),
    totalTaxCents: BigInt(result.batch_totals.total_tax_cents),
    totalNetCents: BigInt(result.batch_totals.total_net_cents),
    results,
  };
}

/**
 * Validate payroll credentials inside TEE.
 */
export async function validateCredentialsInTee(
  deps: LivePayrollDeps,
  cycleId: string,
): Promise<boolean> {
  const scriptName = getScriptName(deps.tenantDid);
  const scriptVersion = await getContractVersion(getNodeUrl(), scriptName);

  const result = await deps.t3n.executeAndDecode<{ valid: boolean }>({
    contract_id: scriptName,
    contract_version: scriptVersion,
    function_name: "validate-credentials",
    input: { cycle_id: cycleId },
  });

  return result.valid;
}

/**
 * Execute disbursement inside TEE.
 */
export async function executeDisbursementInTee(
  deps: LivePayrollDeps,
  cycleId: string,
  batchCapCents: bigint,
): Promise<{ disbursement_id: string; status: string }> {
  const scriptName = getScriptName(deps.tenantDid);
  const scriptVersion = await getContractVersion(getNodeUrl(), scriptName);

  return deps.t3n.executeAndDecode<{ disbursement_id: string; status: string }>({
    contract_id: scriptName,
    contract_version: scriptVersion,
    function_name: "execute-disbursement",
    input: {
      cycle_id: cycleId,
      batch_cap_cents: centsToWireString(batchCapCents),
    },
  });
}

/**
 * List audit cycles from TEE.
 */
export async function listAuditCyclesInTee(
  deps: LivePayrollDeps,
): Promise<Array<{ cycle_id: string; processed_at: string; status: string }>> {
  const scriptName = getScriptName(deps.tenantDid);
  const scriptVersion = await getContractVersion(getNodeUrl(), scriptName);

  const result = await deps.t3n.executeAndDecode<{
    cycles: Array<{ cycle_id: string; processed_at: string; status: string }>;
  }>({
    contract_id: scriptName,
    contract_version: scriptVersion,
    function_name: "list-audit-cycles",
    input: {},
  });

  return result.cycles;
}
