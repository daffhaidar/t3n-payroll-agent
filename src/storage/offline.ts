/**
 * Offline storage — reads/writes employee and batch data to local JSON files.
 * Only used in offline mode. Never described as confidential or compliance-grade.
 *
 * Key invariants:
 * - Employee baseSalaryCents stored as decimal STRING (not raw bigint)
 * - Loaded with validated centsFromString() — rejects malformed data
 * - Atomic writes: write to temp file, then rename
 * - PAYROLL_DATA_DIR configurable via env (default: .payroll)
 */

import fs from "node:fs";
import path from "node:path";
import type { Employee, EmployeeDTO, PayrollBatch, PayrollBatchDTO } from "../payroll/types.js";
import { centsFromString } from "../money.js";

function getDataDir(): string {
  return process.env["PAYROLL_DATA_DIR"] ?? path.join(process.cwd(), ".payroll");
}

function getEmployeesFile(): string {
  return path.join(getDataDir(), "employees.json");
}

function getBatchesDir(): string {
  return path.join(getDataDir(), "batches");
}

export function ensureDirs(): void {
  const dataDir = getDataDir();
  const batchesDir = getBatchesDir();
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(batchesDir)) fs.mkdirSync(batchesDir, { recursive: true });
}

/**
 * Atomic write: write to a temp file, then rename.
 * Prevents partial writes from corrupting storage.
 */
function atomicWrite(filePath: string, content: string): void {
  ensureDirs();
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, filePath);
}

// ── Employees ───────────────────────────────────────────────────────

/**
 * Convert runtime Employee → on-disk EmployeeDTO.
 * Serializes baseSalaryCents as decimal string.
 */
function employeeToDTO(emp: Employee): EmployeeDTO {
  return {
    id: emp.id,
    name: emp.name,
    walletAddress: emp.walletAddress,
    baseSalaryCents: emp.baseSalaryCents.toString(),
    department: emp.department,
    taxBasisPoints: emp.taxBasisPoints,
  };
}

/**
 * Convert on-disk EmployeeDTO → runtime Employee.
 * Validates and parses baseSalaryCents from string.
 */
function dtoToEmployee(dto: EmployeeDTO): Employee {
  if (typeof dto.id !== "string" || dto.id.length === 0) {
    throw new Error("Corrupted storage: employee missing valid id");
  }
  if (typeof dto.name !== "string") {
    throw new Error(`Corrupted storage: employee ${dto.id} missing name`);
  }
  if (typeof dto.walletAddress !== "string") {
    throw new Error(`Corrupted storage: employee ${dto.id} missing walletAddress`);
  }
  if (typeof dto.baseSalaryCents !== "string") {
    throw new Error(`Corrupted storage: employee ${dto.id} baseSalaryCents must be a string`);
  }
  if (typeof dto.department !== "string") {
    throw new Error(`Corrupted storage: employee ${dto.id} missing department`);
  }
  if (typeof dto.taxBasisPoints !== "number" || !Number.isInteger(dto.taxBasisPoints)) {
    throw new Error(`Corrupted storage: employee ${dto.id} taxBasisPoints must be an integer`);
  }

  return {
    id: dto.id,
    name: dto.name,
    walletAddress: dto.walletAddress,
    baseSalaryCents: centsFromString(dto.baseSalaryCents),
    department: dto.department,
    taxBasisPoints: dto.taxBasisPoints,
  };
}

export function loadEmployees(): Employee[] {
  const file = getEmployeesFile();
  if (!fs.existsSync(file)) return [];

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    throw new Error(`Corrupted employee storage: invalid JSON — ${err}`);
  }

  if (!Array.isArray(raw)) {
    throw new Error("Corrupted employee storage: expected array");
  }

  return raw.map((item, i) => {
    try {
      return dtoToEmployee(item as EmployeeDTO);
    } catch (err) {
      throw new Error(`Corrupted storage at index ${i}: ${err}`);
    }
  });
}

export function saveEmployees(employees: Employee[]): void {
  const dtos = employees.map(employeeToDTO);
  atomicWrite(getEmployeesFile(), JSON.stringify(dtos, null, 2));
}

// ── Batches ─────────────────────────────────────────────────────────

function batchToDTO(batch: PayrollBatch): PayrollBatchDTO {
  return {
    batchId: batch.batchId,
    processedAt: batch.processedAt,
    tenantDid: batch.tenantDid,
    cycleId: batch.cycleId,
    payPeriodStart: batch.payPeriodStart,
    payPeriodEnd: batch.payPeriodEnd,
    totalEmployees: batch.totalEmployees,
    totalGrossCents: batch.totalGrossCents.toString(),
    totalTaxCents: batch.totalTaxCents.toString(),
    totalNetCents: batch.totalNetCents.toString(),
    results: batch.results.map((r) => ({
      employeeId: r.employeeId,
      grossPayCents: r.grossPayCents.toString(),
      taxWithheldCents: r.taxWithheldCents.toString(),
      netPayCents: r.netPayCents.toString(),
      payDate: r.payDate,
      status: r.status,
    })),
  };
}

function dtoToBatch(dto: PayrollBatchDTO): PayrollBatch {
  if (typeof dto.batchId !== "string") throw new Error("Corrupted batch: missing batchId");
  if (typeof dto.cycleId !== "string") throw new Error(`Batch ${dto.batchId}: missing cycleId`);
  if (typeof dto.payPeriodStart !== "string") throw new Error(`Batch ${dto.batchId}: missing payPeriodStart`);
  if (typeof dto.payPeriodEnd !== "string") throw new Error(`Batch ${dto.batchId}: missing payPeriodEnd`);

  return {
    batchId: dto.batchId,
    processedAt: dto.processedAt,
    tenantDid: dto.tenantDid,
    cycleId: dto.cycleId,
    payPeriodStart: dto.payPeriodStart,
    payPeriodEnd: dto.payPeriodEnd,
    totalEmployees: dto.totalEmployees,
    totalGrossCents: centsFromString(dto.totalGrossCents),
    totalTaxCents: centsFromString(dto.totalTaxCents),
    totalNetCents: centsFromString(dto.totalNetCents),
    results: dto.results.map((r) => ({
      employeeId: r.employeeId,
      grossPayCents: centsFromString(r.grossPayCents),
      taxWithheldCents: centsFromString(r.taxWithheldCents),
      netPayCents: centsFromString(r.netPayCents),
      payDate: r.payDate,
      status: r.status,
    })),
  };
}

export function saveBatch(batch: PayrollBatch): void {
  ensureDirs();
  const file = path.join(getBatchesDir(), `${batch.batchId}.json`);
  atomicWrite(file, JSON.stringify(batchToDTO(batch), null, 2));
}

export function loadBatch(batchId: string): PayrollBatch | null {
  const file = path.join(getBatchesDir(), `${batchId}.json`);
  if (!fs.existsSync(file)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    throw new Error(`Corrupted batch storage for ${batchId}: invalid JSON — ${err}`);
  }

  return dtoToBatch(raw as PayrollBatchDTO);
}

export function listBatchIds(): string[] {
  const batchesDir = getBatchesDir();
  if (!fs.existsSync(batchesDir)) return [];
  return fs
    .readdirSync(batchesDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .sort()
    .reverse();
}
