#!/usr/bin/env node
/**
 * Phase 3: Register and invoke the real T3N payroll contract.
 *
 * This script:
 * 1. Connects to T3N testnet
 * 2. Reads the compiled WASM
 * 3. Registers the contract
 * 4. Creates employees and audit KV maps
 * 5. Seeds demo employee records
 * 6. Invokes compute-payroll
 * 7. Records sanitized proof
 *
 * BLOCKED without rotated T3N_API_KEY in environment.
 */

import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  T3nClient,
  TenantClient,
  setEnvironment,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
  fetchTrustedManifest,
  getEnvironment,
  getContractVersion,
  getNodeUrl,
} from "@terminal3/t3n-sdk";
import type { TenantSdkEnvironment } from "@terminal3/t3n-sdk";

// ── Config ──────────────────────────────────────────────────────────
const T3N_API_KEY = process.env["T3N_API_KEY"];
const CLUSTER = (process.env["CLUSTER"] || "testnet") as TenantSdkEnvironment;
const WASM_PATH = path.resolve(
  process.cwd(),
  "contracts/payroll/target/wasm32-wasip2/release/z_payroll.wasm",
);
const CONTRACT_TAIL = "payroll";
const CONTRACT_VERSION = "0.1.0";
const PROOF_DIR = path.resolve(process.cwd(), "proofs");

// ── Validation ──────────────────────────────────────────────────────
if (!T3N_API_KEY) {
  console.error("BLOCKED: T3N_API_KEY environment variable is required");
  process.exit(1);
}

const VALID_ENVS: readonly TenantSdkEnvironment[] = ["sandbox", "testnet", "production"];
if (!(VALID_ENVS as readonly string[]).includes(CLUSTER)) {
  console.error(`BLOCKED: Invalid CLUSTER "${CLUSTER}". Must be: ${VALID_ENVS.join(", ")}`);
  process.exit(1);
}

if (!existsSync(WASM_PATH)) {
  console.error(`BLOCKED: WASM not found at ${WASM_PATH}`);
  console.error("Run: cargo build --release --target wasm32-wasip2 --manifest-path contracts/payroll/Cargo.toml");
  process.exit(1);
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log("Phase 3: Register and invoke T3N payroll contract");
  console.log("═══════════════════════════════════════════════════\n");

  // Step 1: Connect
  console.log("Step 1: Connecting to T3N...");
  setEnvironment(CLUSTER);

  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(T3N_API_KEY);
  const env = getEnvironment();
  const trustAnchor = await fetchTrustedManifest(env);

  const t3n = new T3nClient({
    wasmComponent,
    trustAnchor,
    handlers: {
      EthSign: metamask_sign(address, undefined, T3N_API_KEY),
    },
  });

  await t3n.handshake();
  const did = await t3n.authenticate(createEthAuthInput(address));
  const tenantDid = did.value;
  const nodeUrl = getNodeUrl();

  console.log(`  tenantDid: ${tenantDid}`);
  console.log(`  address:   ${address}`);
  console.log(`  nodeUrl:   ${nodeUrl}\n`);

  // Step 2: Create TenantClient
  console.log("Step 2: Creating TenantClient...");
  const tenant = new TenantClient({
    environment: CLUSTER,
    t3n,
    tenantDid,
    baseUrl: nodeUrl,
  });
  console.log("  TenantClient created\n");

  // Step 3: Register contract
  console.log("Step 3: Registering payroll contract...");
  const wasmBytes = await readFile(WASM_PATH);
  console.log(`  WASM size: ${wasmBytes.length} bytes`);

  let registerResult: { name: string; contract_id: number };
  try {
    registerResult = await tenant.contracts.register({
      tail: CONTRACT_TAIL,
      version: CONTRACT_VERSION,
      wasm: wasmBytes,
    });
    console.log(`  name:        ${registerResult.name}`);
    console.log(`  contract_id: ${registerResult.contract_id}`);
  } catch (err) {
    const error = err as Error & { request_id?: string };
    const msg = error.message;

    // If version already registered, look up existing contract
    if (msg.includes("not higher than current version")) {
      console.log(`  Contract already registered (version ${CONTRACT_VERSION})`);
      console.log(`  Looking up existing contract...`);

      const scriptName = `z:${tenantDid.replace("did:t3n:", "")}:${CONTRACT_TAIL}`;
      registerResult = { name: scriptName, contract_id: 0 };

      // List contracts to find the contract_id
      try {
        const contracts = await tenant.contracts.list();
        console.log(`  Registered contracts: ${contracts.join(", ")}`);
      } catch {
        console.log("  Could not list contracts");
      }
    } else {
      console.error(`  REGISTRATION FAILED: ${msg}`);
      if (error.request_id) console.error(`  request_id: ${error.request_id}`);

      await recordBlocker({
        phase: "register",
        error: msg,
        request_id: error.request_id,
        sdk_version: "5.2.0",
        node_version: process.version,
        npm_version: (await import("node:child_process"))
          .execSync("npm --version")
          .toString()
          .trim(),
        cluster: CLUSTER,
        timestamp: new Date().toISOString(),
      });
      process.exit(1);
    }
  }
  console.log("");

  // Step 4: Resolve contract version
  console.log("Step 4: Resolving contract version...");
  const scriptName = registerResult.name;
  let scriptVersion: string;
  try {
    scriptVersion = await getContractVersion(nodeUrl, scriptName);
    console.log(`  scriptName:   ${scriptName}`);
    console.log(`  scriptVersion: ${scriptVersion}`);
  } catch (err) {
    console.error(`  Version resolution failed: ${err}`);
    scriptVersion = CONTRACT_VERSION;
  }
  console.log("");

  // Step 5: Create KV maps
  console.log("Step 5: Creating KV maps...");
  try {
    await tenant.maps.create({
      tail: "employees",
      visibility: "private",
      writers: { only: [registerResult.contract_id] },
      readers: { only: [registerResult.contract_id] },
    });
    console.log("  employees map created");
  } catch (err) {
    console.log(`  employees map: ${err}`);
  }

  try {
    await tenant.maps.create({
      tail: "audit",
      visibility: "private",
      writers: { only: [registerResult.contract_id] },
      readers: { only: [registerResult.contract_id] },
    });
    console.log("  audit map created");
  } catch (err) {
    console.log(`  audit map: ${err}`);
  }
  console.log("");

  // Step 6: Seed demo employees
  console.log("Step 6: Seeding demo employees...");
  const demoEmployees = [
    {
      id: "EMP-001",
      department: "Engineering",
      base_salary_cents: 500000,
      tax_basis_points: 2000,
    },
    {
      id: "EMP-002",
      department: "Design",
      base_salary_cents: 420000,
      tax_basis_points: 1800,
    },
    {
      id: "EMP-003",
      department: "Engineering",
      base_salary_cents: 650000,
      tax_basis_points: 2200,
    },
  ];

  for (const emp of demoEmployees) {
    try {
      await tenant.maps.entrySet("employees", emp.id, JSON.stringify(emp));
      console.log(`  seeded ${emp.id}`);
    } catch (err) {
      console.log(`  seed ${emp.id}: ${err}`);
    }
  }
  console.log("");

  // Step 7: Invoke compute-payroll
  console.log("Step 7: Invoking compute-payroll...");
  const invokeInput = {
    cycle_id: `cycle-${Date.now()}`,
    pay_period_start: "2026-08-01",
    pay_period_end: "2026-08-31",
    batch_cap_cents: 100000000000,
    employees: demoEmployees,
  };

  let invokeResult: unknown;
  try {
    invokeResult = await tenant.contracts.execute(CONTRACT_TAIL, {
      version: scriptVersion,
      functionName: "compute-payroll",
      input: invokeInput,
    });
    console.log("  compute-payroll succeeded");
  } catch (err) {
    const error = err as Error & { request_id?: string };
    console.error(`  INVOKE FAILED: ${error.message}`);
    if (error.request_id) console.error(`  request_id: ${error.request_id}`);
    invokeResult = { error: error.message, request_id: error.request_id };
  }
  console.log("");

  // Step 8: Record proof
  console.log("Step 8: Recording proof...");
  await mkdir(PROOF_DIR, { recursive: true });

  const proof = {
    cluster: CLUSTER,
    tenant_did: tenantDid,
    canonical_name: scriptName,
    contract_id: registerResult.contract_id,
    contract_version: scriptVersion,
    invoked_function: "compute-payroll",
    success: !("error" in (invokeResult as Record<string, unknown>)),
    result: invokeResult,
    timestamp: new Date().toISOString(),
    node_url: nodeUrl,
  };

  const proofPath = path.join(PROOF_DIR, `phase3-${Date.now()}.json`);
  await writeFile(proofPath, JSON.stringify(proof, null, 2));
  console.log(`  proof: ${proofPath}\n`);

  // Summary
  console.log("═══════════════════════════════════════════════════");
  console.log("  Phase 3 Complete");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  cluster:    ${CLUSTER}`);
  console.log(`  tenantDid:  ${tenantDid}`);
  console.log(`  contract:   ${scriptName}`);
  console.log(`  contractId: ${registerResult.contract_id}`);
  console.log(`  version:    ${scriptVersion}`);
  console.log(`  function:   compute-payroll`);
  console.log(`  success:    ${proof.success}`);
  console.log("═══════════════════════════════════════════════════");
}

async function recordBlocker(blocker: Record<string, unknown>) {
  await mkdir(PROOF_DIR, { recursive: true });
  const path = `${PROOF_DIR}/blocker-phase3-${Date.now()}.json`;
  await writeFile(path, JSON.stringify(blocker, null, 2));
  console.error(`  Blocker recorded: ${path}`);
}

main().catch((err) => {
  console.error(`Fatal: ${err}`);
  process.exit(1);
});
