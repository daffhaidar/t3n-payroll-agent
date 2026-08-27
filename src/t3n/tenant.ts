/**
 * Tenant contract management — register, publish, and execute payroll contracts.
 * This is the SINGLE canonical implementation for contract operations.
 * Do not duplicate in live.ts or elsewhere.
 */

import { readFile } from "node:fs/promises";
import type { TenantClient, ContractRegisterResult } from "@terminal3/t3n-sdk";

const PAYROLL_CONTRACT_TAIL = "payroll";
const PAYROLL_VERSION = "0.1.0";

/**
 * Register the payroll WASM contract with the tenant.
 */
export async function registerPayrollContract(
  tenant: TenantClient,
  wasmPath: string,
): Promise<ContractRegisterResult> {
  const wasmBytes = await readFile(wasmPath);

  const result = await tenant.contracts.register({
    tail: PAYROLL_CONTRACT_TAIL,
    version: PAYROLL_VERSION,
    wasm: wasmBytes,
  });

  return result;
}

/**
 * List all registered contracts for the tenant.
 */
export async function listContracts(
  tenant: TenantClient,
): Promise<string[]> {
  return tenant.contracts.list();
}

/**
 * Execute a payroll function inside the TEE.
 */
export async function executePayrollFunction(
  tenant: TenantClient,
  functionName: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  return tenant.contracts.execute(PAYROLL_CONTRACT_TAIL, {
    version: PAYROLL_VERSION,
    functionName,
    input,
  });
}
