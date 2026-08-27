#!/usr/bin/env node

import "dotenv/config";
import { Command } from "commander";
import { loadConfig } from "./config.js";
import {
  parseDollarsToCents,
  parseBasisPoints,
  formatDollars,
  calculateTax,
  calculateNet,
} from "./money.js";
import {
  validateWalletAddress,
  validateEmployeeId,
  validateCycleId,
  validatePayPeriod,
  validateBatchCap,
} from "./validation.js";
import type { Employee, PayrollBatch } from "./payroll/types.js";
import { computeOfflinePayroll } from "./payroll/offline.js";
import {
  loadEmployees,
  saveEmployees,
  saveBatch,
  loadBatch,
  listBatchIds,
  ensureDirs,
} from "./storage/offline.js";

// ── CLI ─────────────────────────────────────────────────────────────
const program = new Command();

program
  .name("t3n-payroll")
  .description("Enterprise Payroll Agent running inside Terminal 3 TEE")
  .version("1.0.0");

// ── connect ─────────────────────────────────────────────────────────
program
  .command("connect")
  .description("Connect to T3N testnet and verify authentication")
  .action(async () => {
    const config = loadConfig();
    console.log(`Connecting to T3N ${config.environment}...`);

    const { connectToT3n } = await import("./t3n/client.js");
    const { tenantDid, address } = await connectToT3n(config.apiKey, config.environment);

    console.log("═══════════════════════════════════════════");
    console.log("  Connected successfully");
    console.log("═══════════════════════════════════════════");
    console.log("  tenantDid :", tenantDid);
    console.log("  address   :", address);
    console.log("═══════════════════════════════════════════");
  });

// ── add ─────────────────────────────────────────────────────────────
program
  .command("add")
  .description("Add an employee to the payroll system")
  .requiredOption("--id <id>", "Employee ID")
  .requiredOption("--name <name>", "Full name")
  .requiredOption("--wallet <address>", "Wallet address (0x...)")
  .requiredOption("--salary <amount>", "Monthly base salary in dollars (e.g. 5000.00)")
  .requiredOption("--department <dept>", "Department name")
  .requiredOption("--tax <rate>", "Tax rate in basis points (e.g. 2000 for 20%)")
  .action((opts) => {
    validateEmployeeId(opts.id);
    validateWalletAddress(opts.wallet);

    const salaryCents = parseDollarsToCents(opts.salary);
    const taxBp = parseBasisPoints(opts.tax);

    const employees = loadEmployees();
    if (employees.find((e) => e.id === opts.id)) {
      console.error(`ERROR: Employee ${opts.id} already exists`);
      process.exit(1);
    }

    const emp: Employee = {
      id: opts.id,
      walletAddress: opts.wallet,
      baseSalaryCents: salaryCents,
      department: opts.department,
      taxBasisPoints: taxBp,
    };

    employees.push(emp);
    saveEmployees(employees);

    const tax = calculateTax(salaryCents, taxBp);
    const net = calculateNet(salaryCents, tax);

    console.log(`✓ Added ${opts.name} (${emp.id})`);
    console.log(`  Department : ${emp.department}`);
    console.log(`  Salary     : ${formatDollars(salaryCents)} USDC/month`);
    console.log(`  Tax Rate   : ${(taxBp / 100).toFixed(1)}%`);
    console.log(`  Net Pay    : ${formatDollars(net)} USDC/month`);
  });

// ── list ────────────────────────────────────────────────────────────
program
  .command("list")
  .description("List all employees (salary data redacted in summary)")
  .action(() => {
    const employees = loadEmployees();
    if (employees.length === 0) {
      console.log("No employees found. Add one with: t3n-payroll add --help");
      return;
    }

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("  ID       | Department  | Tax Rate");
    console.log("═══════════════════════════════════════════════════════════════════");

    for (const emp of employees) {
      console.log(
        `  ${emp.id.padEnd(9)}| ${emp.department.padEnd(12)}| ${(emp.taxBasisPoints / 100).toFixed(1)}%`,
      );
    }

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log(`  Total employees: ${employees.length}`);
  });

// ── remove ──────────────────────────────────────────────────────────
program
  .command("remove")
  .description("Remove an employee by ID")
  .requiredOption("--id <id>", "Employee ID to remove")
  .action((opts) => {
    const employees = loadEmployees();
    const idx = employees.findIndex((e) => e.id === opts.id);

    if (idx === -1) {
      console.error(`ERROR: Employee ${opts.id} not found`);
      process.exit(1);
    }

    const removed = employees.splice(idx, 1)![0]!;
    saveEmployees(employees);
    console.log(`✓ Removed employee ${removed.id}`);
  });

// ── process ─────────────────────────────────────────────────────────
program
  .command("process")
  .description("Process payroll for all employees")
  .requiredOption("--offline", "Run in offline mode (NOT in TEE)")
  .requiredOption("--cycle <id>", "Payroll cycle ID")
  .requiredOption("--period-start <date>", "Pay period start (YYYY-MM-DD)")
  .requiredOption("--period-end <date>", "Pay period end (YYYY-MM-DD)")
  .requiredOption("--cap <cents>", "Batch cap in cents (e.g. 5000000 for $50,000)")
  .action(async (opts) => {
    const employees = loadEmployees();
    if (employees.length === 0) {
      console.error("ERROR: No employees. Add some first with: t3n-payroll add");
      process.exit(1);
    }

    validateCycleId(opts.cycle);
    validatePayPeriod(opts.periodStart, opts.periodEnd);
    validateBatchCap(BigInt(opts.cap));

    // Offline mode
    if (opts.offline) {
      const batch = computeOfflinePayroll(employees, "offline");
      saveBatch(batch);
      printBatchSummary(batch);
      return;
    }

    // Live TEE mode
    console.log("Connecting to T3N...");
    const config = loadConfig();
    const { connectToT3n } = await import("./t3n/client.js");
    const { tenantDid, tenant } = await connectToT3n(config.apiKey, config.environment);

    console.log(`Tenant: ${tenantDid}`);
    console.log(`Processing payroll cycle ${opts.cycle}...`);

    const { executePayrollFunction } = await import("./t3n/tenant.js");

    try {
      const result = (await executePayrollFunction(tenant, "compute-payroll", {
        cycle_id: opts.cycle,
        pay_period_start: opts.periodStart,
        pay_period_end: opts.periodEnd,
        batch_cap_cents: opts.cap,
      })) as {
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
      };

      const batch: PayrollBatch = {
        batchId: `tee-batch-${opts.cycle}`,
        processedAt: new Date().toISOString(),
        tenantDid,
        totalEmployees: result.employee_results.length,
        totalGrossCents: BigInt(result.batch_totals.total_gross_cents),
        totalTaxCents: BigInt(result.batch_totals.total_tax_cents),
        totalNetCents: BigInt(result.batch_totals.total_net_cents),
        results: result.employee_results.map((er) => ({
          employeeId: er.employee_id,
          grossPayCents: BigInt(er.gross_pay_cents),
          taxWithheldCents: BigInt(er.tax_withheld_cents),
          netPayCents: BigInt(er.net_pay_cents),
          payDate: new Date().toISOString().split("T")[0]!,
          status: "validated" as const,
        })),
      };

      saveBatch(batch);
      printBatchSummary(batch);
    } catch (err) {
      console.error(`TEE execution failed: ${err}`);
      process.exit(1);
    }
  });

// ── register ────────────────────────────────────────────────────────
program
  .command("register")
  .description("Register the payroll WASM contract with T3N")
  .requiredOption("--wasm <path>", "Path to the compiled .wasm file")
  .action(async (opts) => {
    console.log("Connecting to T3N...");
    const config = loadConfig();
    const { connectToT3n } = await import("./t3n/client.js");
    const { tenant, tenantDid } = await connectToT3n(config.apiKey, config.environment);

    console.log(`Registering payroll contract for tenant ${tenantDid}...`);

    const { registerPayrollContract } = await import("./t3n/tenant.js");
    const result = await registerPayrollContract(tenant, opts.wasm);

    console.log("═══════════════════════════════════════════");
    console.log("  Contract registered");
    console.log("═══════════════════════════════════════════");
    console.log("  name        :", result.name);
    console.log("  contract_id :", result.contract_id);
    console.log("═══════════════════════════════════════════");
  });

// ── contracts ───────────────────────────────────────────────────────
program
  .command("contracts")
  .description("List all registered contracts for this tenant")
  .action(async () => {
    const config = loadConfig();
    const { connectToT3n } = await import("./t3n/client.js");
    const { tenant } = await connectToT3n(config.apiKey, config.environment);

    const { listContracts } = await import("./t3n/tenant.js");
    const contracts = await listContracts(tenant);

    if (contracts.length === 0) {
      console.log("No contracts registered. Register with: t3n-payroll register --wasm <path>");
      return;
    }

    console.log("Registered contracts:");
    for (const c of contracts) {
      console.log(`  - ${c}`);
    }
  });

// ── history ─────────────────────────────────────────────────────────
program
  .command("history")
  .description("Show payroll batch history (offline only)")
  .action(() => {
    ensureDirs();
    const ids = listBatchIds();

    if (ids.length === 0) {
      console.log("No batches yet. Run: t3n-payroll process --offline --cycle ...");
      return;
    }

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("  Batch ID            | Employees | Net Total");
    console.log("═══════════════════════════════════════════════════════════════════");

    for (const id of ids) {
      const batch = loadBatch(id);
      if (!batch) continue;
      console.log(
        `  ${batch.batchId.padEnd(20)} | ${String(batch.totalEmployees).padStart(9)} | ${formatDollars(batch.totalNetCents)}`,
      );
    }

    console.log("═══════════════════════════════════════════════════════════════════");
  });

// ── show ────────────────────────────────────────────────────────────
program
  .command("show")
  .description("Show details of a specific batch")
  .requiredOption("--batch <id>", "Batch ID")
  .action((opts) => {
    const batch = loadBatch(opts.batch);
    if (!batch) {
      console.error(`ERROR: Batch ${opts.batch} not found`);
      process.exit(1);
    }

    console.log(JSON.stringify(batch, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    , 2));
  });

// ── Helpers ─────────────────────────────────────────────────────────
function printBatchSummary(batch: PayrollBatch): void {
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log(`  BATCH: ${batch.batchId}`);
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log(`  Total Gross : ${formatDollars(batch.totalGrossCents)}`);
  console.log(`  Total Tax   : ${formatDollars(batch.totalTaxCents)}`);
  console.log(`  Total Net   : ${formatDollars(batch.totalNetCents)}`);
  console.log(`  Employees   : ${batch.totalEmployees}`);
  console.log("═══════════════════════════════════════════════════════════════════");
}

program.parse();
