/**
 * Offline storage — reads/writes employee and batch data to local JSON files.
 * Only used in offline mode. Never described as confidential or compliance-grade.
 */

import fs from "node:fs";
import path from "node:path";
import type { Employee, PayrollBatch } from "../payroll/types.js";

const DATA_DIR = path.join(process.cwd(), ".payroll");
const EMPLOYEES_FILE = path.join(DATA_DIR, "employees.json");
const BATCHES_DIR = path.join(DATA_DIR, "batches");

export function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BATCHES_DIR)) fs.mkdirSync(BATCHES_DIR, { recursive: true });
}

export function loadEmployees(): Employee[] {
  if (!fs.existsSync(EMPLOYEES_FILE)) return [];
  return JSON.parse(fs.readFileSync(EMPLOYEES_FILE, "utf-8"));
}

export function saveEmployees(employees: Employee[]): void {
  ensureDirs();
  fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(employees, null, 2));
}

export function saveBatch(batch: PayrollBatch): void {
  ensureDirs();
  // Serialize bigint fields to strings for JSON
  const serializable = {
    ...batch,
    totalGrossCents: batch.totalGrossCents.toString(),
    totalTaxCents: batch.totalTaxCents.toString(),
    totalNetCents: batch.totalNetCents.toString(),
    results: batch.results.map((r) => ({
      ...r,
      grossPayCents: r.grossPayCents.toString(),
      taxWithheldCents: r.taxWithheldCents.toString(),
      netPayCents: r.netPayCents.toString(),
    })),
  };
  const file = path.join(BATCHES_DIR, `${batch.batchId}.json`);
  fs.writeFileSync(file, JSON.stringify(serializable, null, 2));
}

export function loadBatch(batchId: string): PayrollBatch | null {
  const file = path.join(BATCHES_DIR, `${batchId}.json`);
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
  // Deserialize bigint fields
  return {
    ...raw,
    totalGrossCents: BigInt(raw.totalGrossCents),
    totalTaxCents: BigInt(raw.totalTaxCents),
    totalNetCents: BigInt(raw.totalNetCents),
    results: raw.results.map((r: Record<string, string>) => ({
      ...r,
      grossPayCents: BigInt(r["grossPayCents"] ?? "0"),
      taxWithheldCents: BigInt(r["taxWithheldCents"] ?? "0"),
      netPayCents: BigInt(r["netPayCents"] ?? "0"),
    })),
  };
}

export function listBatchIds(): string[] {
  ensureDirs();
  return fs
    .readdirSync(BATCHES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .sort()
    .reverse();
}
