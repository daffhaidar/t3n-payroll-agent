import type { Cents, BasisPoints } from "../money.js";

export type PayrollStatus = "calculated" | "validated" | "disbursed" | "failed";

export interface Employee {
  id: string;
  name: string;
  walletAddress: string;
  baseSalaryCents: Cents;
  department: string;
  taxBasisPoints: BasisPoints;
}

/**
 * On-disk DTO: all monetary fields stored as decimal strings.
 * Never store raw BigInt — JSON.stringify cannot serialize it.
 */
export interface EmployeeDTO {
  id: string;
  name: string;
  walletAddress: string;
  baseSalaryCents: string;
  department: string;
  taxBasisPoints: number;
}

export interface EmployeeInput {
  id: string;
  walletAddress: string;
  /** Dollar string, e.g. "5000.00" */
  baseSalary: string;
  department: string;
  /** Basis points string, e.g. "2000" for 20% */
  taxRate: string;
}

export interface PayrollResult {
  employeeId: string;
  grossPayCents: Cents;
  taxWithheldCents: Cents;
  netPayCents: Cents;
  payDate: string;
  status: PayrollStatus;
}

export interface PayrollBatch {
  batchId: string;
  processedAt: string;
  tenantDid: string;
  cycleId: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  totalEmployees: number;
  totalGrossCents: Cents;
  totalTaxCents: Cents;
  totalNetCents: Cents;
  results: PayrollResult[];
}

/**
 * On-disk DTO for batches: all bigint fields stored as decimal strings.
 */
export interface PayrollBatchDTO {
  batchId: string;
  processedAt: string;
  tenantDid: string;
  cycleId: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  totalEmployees: number;
  totalGrossCents: string;
  totalTaxCents: string;
  totalNetCents: string;
  results: Array<{
    employeeId: string;
    grossPayCents: string;
    taxWithheldCents: string;
    netPayCents: string;
    payDate: string;
    status: PayrollStatus;
  }>;
}

/**
 * TEE payroll request — matches the SDK's PayrollRunRequest shape.
 * All monetary values are cents (bigint → decimal string on wire).
 */
export interface TeePayrollRequest {
  org_id: string;
  cycle_id: string;
  pay_period_start: string;
  pay_period_end: string;
  batch_cap_cents: bigint;
  historical_baselines: Record<string, string>;
  individual_disbursement_threshold_cents?: bigint;
}

/**
 * Result from TEE compute-payroll execution.
 */
export interface TeePayrollComputeResult {
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
}
