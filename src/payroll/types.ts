import type { Cents, BasisPoints } from "../money.js";

export type PayrollStatus = "calculated" | "validated" | "disbursed" | "failed";

export interface Employee {
  id: string;
  walletAddress: string;
  baseSalaryCents: Cents;
  department: string;
  taxBasisPoints: BasisPoints;
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
  totalEmployees: number;
  totalGrossCents: Cents;
  totalTaxCents: Cents;
  totalNetCents: Cents;
  results: PayrollResult[];
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
