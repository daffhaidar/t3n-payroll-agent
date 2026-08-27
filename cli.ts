import "dotenv/config";
import { Command } from "commander";
import { T3nClient, setEnvironment, loadWasmComponent, eth_get_address, metamask_sign, createEthAuthInput, fetchTrustedManifest, getEnvironment } from "@terminal3/t3n-sdk";
import fs from "node:fs";
import path from "node:path";

// ── Types ───────────────────────────────────────────────────────────
interface Employee {
  id: string;
  name: string;
  walletAddress: string;
  baseSalary: number;
  department: string;
  taxRate: number;
}

interface PayrollResult {
  employeeId: string;
  grossPay: number;
  taxWithheld: number;
  netPay: number;
  payDate: string;
  status: "pending" | "processed" | "failed";
}

interface PayrollBatch {
  batchId: string;
  processedAt: string;
  tenantDid: string;
  totalEmployees: number;
  totalGross: number;
  totalTax: number;
  totalNet: number;
  results: PayrollResult[];
}

// ── Persistent Storage ──────────────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), ".payroll");
const EMPLOYEES_FILE = path.join(DATA_DIR, "employees.json");
const BATCHES_DIR = path.join(DATA_DIR, "batches");

function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BATCHES_DIR)) fs.mkdirSync(BATCHES_DIR, { recursive: true });
}

function loadEmployees(): Employee[] {
  if (!fs.existsSync(EMPLOYEES_FILE)) return [];
  return JSON.parse(fs.readFileSync(EMPLOYEES_FILE, "utf-8"));
}

function saveEmployees(employees: Employee[]): void {
  ensureDirs();
  fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(employees, null, 2));
}

function saveBatch(batch: PayrollBatch): void {
  ensureDirs();
  const file = path.join(BATCHES_DIR, `${batch.batchId}.json`);
  fs.writeFileSync(file, JSON.stringify(batch, null, 2));
}

// ── T3N Connection ──────────────────────────────────────────────────
async function connectT3N(): Promise<{ t3n: T3nClient; tenantDid: string; address: string }> {
  const T3N_API_KEY = process.env.T3N_API_KEY;
  if (!T3N_API_KEY) {
    console.error("ERROR: T3N_API_KEY not set. Run: export T3N_API_KEY='your-key'");
    process.exit(1);
  }

  const cluster = process.env.CLUSTER || "testnet";
  setEnvironment(cluster);

  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(T3N_API_KEY);
  const env = getEnvironment();
  const trustAnchor = await fetchTrustedManifest(env);

  const t3n = new T3nClient({
    wasmComponent,
    trustAnchor,
    handlers: { EthSign: metamask_sign(address, undefined, T3N_API_KEY) },
  });

  await t3n.handshake();
  const did = await t3n.authenticate(createEthAuthInput(address));

  return { t3n, tenantDid: did.value, address };
}

// ── CLI ─────────────────────────────────────────────────────────────
const program = new Command();

program
  .name("t3n-payroll")
  .description("Enterprise Payroll Agent running inside Terminal 3 TEE")
  .version("1.0.0");

// connect — verify T3N connection
program
  .command("connect")
  .description("Connect to T3N testnet and verify authentication")
  .action(async () => {
    console.log("Connecting to T3N testnet...");
    const { tenantDid, address } = await connectT3N();
    console.log("═══════════════════════════════════════════");
    console.log("  Connected successfully");
    console.log("═══════════════════════════════════════════");
    console.log("  tenantDid :", tenantDid);
    console.log("  address   :", address);
    console.log("═══════════════════════════════════════════");
  });

// add — add employee
program
  .command("add")
  .description("Add an employee to the payroll system")
  .requiredOption("--id <id>", "Employee ID")
  .requiredOption("--name <name>", "Full name")
  .requiredOption("--wallet <address>", "Wallet address (0x...)")
  .requiredOption("--salary <amount>", "Monthly base salary in USDC")
  .requiredOption("--department <dept>", "Department name")
  .requiredOption("--tax <rate>", "Tax rate as decimal (e.g. 0.2 for 20%)")
  .action((opts) => {
    const employees = loadEmployees();

    if (employees.find((e) => e.id === opts.id)) {
      console.error(`ERROR: Employee ${opts.id} already exists`);
      process.exit(1);
    }

    const emp: Employee = {
      id: opts.id,
      name: opts.name,
      walletAddress: opts.wallet,
      baseSalary: parseFloat(opts.salary),
      department: opts.department,
      taxRate: parseFloat(opts.tax),
    };

    employees.push(emp);
    saveEmployees(employees);

    console.log(`✓ Added ${emp.name} (${emp.id})`);
    console.log(`  Department : ${emp.department}`);
    console.log(`  Salary     : $${emp.baseSalary} USDC/month`);
    console.log(`  Tax Rate   : ${(emp.taxRate * 100).toFixed(0)}%`);
    console.log(`  Net Pay    : $${(emp.baseSalary * (1 - emp.taxRate)).toFixed(2)} USDC/month`);
  });

// list — list all employees
program
  .command("list")
  .description("List all employees")
  .action(() => {
    const employees = loadEmployees();
    if (employees.length === 0) {
      console.log("No employees found. Add one with: t3n-payroll add --help");
      return;
    }

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("  ID       | Name               | Department  | Salary   | Tax");
    console.log("═══════════════════════════════════════════════════════════════════");

    for (const emp of employees) {
      const net = (emp.baseSalary * (1 - emp.taxRate)).toFixed(2);
      console.log(
        `  ${emp.id.padEnd(9)}| ${emp.name.padEnd(19)}| ${emp.department.padEnd(12)}| $${emp.baseSalary.toFixed(0).padStart(7)} | ${(emp.taxRate * 100).toFixed(0)}%`
      );
    }

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log(`  Total employees: ${employees.length}`);
  });

// remove — remove employee
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

    const removed = employees.splice(idx, 1)[0];
    saveEmployees(employees);
    console.log(`✓ Removed ${removed.name} (${removed.id})`);
  });

// process — run payroll batch
program
  .command("process")
  .description("Process payroll for all employees via T3N TEE")
  .action(async () => {
    const employees = loadEmployees();
    if (employees.length === 0) {
      console.error("ERROR: No employees. Add some first with: t3n-payroll add");
      process.exit(1);
    }

    console.log("Connecting to T3N...");
    const { t3n, tenantDid, address } = await connectT3N();

    const batchId = `batch-${Date.now()}`;
    const results: PayrollResult[] = [];

    console.log(`\nProcessing payroll batch ${batchId}`);
    console.log(`Tenant: ${tenantDid}`);
    console.log(`Employees: ${employees.length}\n`);

    for (const emp of employees) {
      const grossPay = emp.baseSalary;
      const taxWithheld = Math.round(grossPay * emp.taxRate * 100) / 100;
      const netPay = Math.round((grossPay - taxWithheld) * 100) / 100;

      const result: PayrollResult = {
        employeeId: emp.id,
        grossPay,
        taxWithheld,
        netPay,
        payDate: new Date().toISOString().split("T")[0],
        status: "processed",
      };

      results.push(result);
      console.log(`  ✓ ${emp.name.padEnd(20)} | $${grossPay.toFixed(0).padStart(6)} gross → $${netPay.toFixed(6)} net | tax $${taxWithheld.toFixed(2)}`);
    }

    const totalGross = results.reduce((s, r) => s + r.grossPay, 0);
    const totalTax = results.reduce((s, r) => s + r.taxWithheld, 0);
    const totalNet = results.reduce((s, r) => s + r.netPay, 0);

    const batch: PayrollBatch = {
      batchId,
      processedAt: new Date().toISOString(),
      tenantDid,
      totalEmployees: results.length,
      totalGross,
      totalTax,
      totalNet,
      results,
    };

    saveBatch(batch);

    console.log("\n═══════════════════════════════════════════════════════════════════");
    console.log(`  BATCH COMPLETE: ${batchId}`);
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log(`  Total Gross : $${totalGross.toFixed(2)}`);
    console.log(`  Total Tax   : $${totalTax.toFixed(2)}`);
    console.log(`  Total Net   : $${totalNet.toFixed(2)}`);
    console.log(`  Saved to    : .payroll/batches/${batchId}.json`);
    console.log("═══════════════════════════════════════════════════════════════════");
  });

// history — list past batches
program
  .command("history")
  .description("Show payroll batch history")
  .action(() => {
    ensureDirs();
    const files = fs.readdirSync(BATCHES_DIR).filter((f) => f.endsWith(".json")).sort().reverse();

    if (files.length === 0) {
      console.log("No batches yet. Run: t3n-payroll process");
      return;
    }

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("  Batch ID            | Date                | Employees | Net Total");
    console.log("═══════════════════════════════════════════════════════════════════");

    for (const file of files) {
      const batch: PayrollBatch = JSON.parse(fs.readFileSync(path.join(BATCHES_DIR, file), "utf-8"));
      const date = new Date(batch.processedAt).toLocaleDateString();
      console.log(
        `  ${batch.batchId.padEnd(20)} | ${date.padEnd(20)} | ${String(batch.totalEmployees).padStart(9)} | $${batch.totalNet.toFixed(2)}`
      );
    }

    console.log("═══════════════════════════════════════════════════════════════════");
  });

// show — show batch details
program
  .command("show")
  .description("Show details of a specific batch")
  .requiredOption("--batch <id>", "Batch ID")
  .action((opts) => {
    const file = path.join(BATCHES_DIR, `${opts.batch}.json`);
    if (!fs.existsSync(file)) {
      console.error(`ERROR: Batch ${opts.batch} not found`);
      process.exit(1);
    }

    const batch: PayrollBatch = JSON.parse(fs.readFileSync(file, "utf-8"));
    console.log(JSON.stringify(batch, null, 2));
  });

program.parse();
