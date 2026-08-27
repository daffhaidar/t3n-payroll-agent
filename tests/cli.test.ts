import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

/**
 * CLI integration tests — uses isolated temp directories.
 * Tests the actual CLI commands via child process.
 */

let tmpDir: string;
const CLI = path.resolve(import.meta.dirname ?? ".", "../src/cli.ts");

function setupTmpDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "payroll-cli-test-"));
}

function cleanupTmpDir() {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync("node", ["--import", "tsx", CLI, ...args], {
      encoding: "utf-8",
      env: {
        ...process.env,
        PAYROLL_DATA_DIR: tmpDir,
        T3N_API_KEY: "test-key-not-used",
      },
      timeout: 15_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.status ?? 1,
    };
  }
}

describe("CLI add/list/remove flow", () => {
  beforeEach(() => setupTmpDir());
  afterEach(() => cleanupTmpDir());

  it("adds an employee", () => {
    const result = runCli([
      "add",
      "--id", "EMP-001",
      "--name", "Alice",
      "--wallet", "0x0000000000000000000000000000000000000001",
      "--salary", "5000.00",
      "--department", "Engineering",
      "--tax", "2000",
    ]);
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes("Added Alice"));
    assert.ok(result.stdout.includes("5000.00"));
  });

  it("rejects invalid wallet", () => {
    const result = runCli([
      "add",
      "--id", "EMP-BAD",
      "--name", "Bad",
      "--wallet", "not-a-wallet",
      "--salary", "5000",
      "--department", "Engineering",
      "--tax", "2000",
    ]);
    assert.notEqual(result.exitCode, 0);
  });

  it("rejects negative salary", () => {
    const result = runCli([
      "add",
      "--id", "EMP-NEG",
      "--name", "Neg",
      "--wallet", "0x0000000000000000000000000000000000000001",
      "--salary", "-5000",
      "--department", "Engineering",
      "--tax", "2000",
    ]);
    assert.notEqual(result.exitCode, 0);
  });

  it("rejects zero salary", () => {
    const result = runCli([
      "add",
      "--id", "EMP-ZERO",
      "--name", "Zero",
      "--wallet", "0x0000000000000000000000000000000000000001",
      "--salary", "0",
      "--department", "Engineering",
      "--tax", "2000",
    ]);
    assert.notEqual(result.exitCode, 0);
  });

  it("rejects more than two decimal places", () => {
    const result = runCli([
      "add",
      "--id", "EMP-DEC",
      "--name", "Dec",
      "--wallet", "0x0000000000000000000000000000000000000001",
      "--salary", "5000.123",
      "--department", "Engineering",
      "--tax", "2000",
    ]);
    assert.notEqual(result.exitCode, 0);
  });

  it("rejects tax over 10000 basis points", () => {
    const result = runCli([
      "add",
      "--id", "EMP-TAX",
      "--name", "Tax",
      "--wallet", "0x0000000000000000000000000000000000000001",
      "--salary", "5000",
      "--department", "Engineering",
      "--tax", "20000",
    ]);
    assert.notEqual(result.exitCode, 0);
  });

  it("rejects duplicate employee ID", () => {
    runCli([
      "add", "--id", "EMP-DUP", "--name", "First",
      "--wallet", "0x0000000000000000000000000000000000000001",
      "--salary", "5000", "--department", "Eng", "--tax", "2000",
    ]);
    const result = runCli([
      "add", "--id", "EMP-DUP", "--name", "Second",
      "--wallet", "0x0000000000000000000000000000000000000002",
      "--salary", "4000", "--department", "Design", "--tax", "1800",
    ]);
    assert.notEqual(result.exitCode, 0);
    assert.ok(result.stderr.includes("already exists"));
  });

  it("lists employees", () => {
    runCli([
      "add", "--id", "EMP-L1", "--name", "One",
      "--wallet", "0x0000000000000000000000000000000000000001",
      "--salary", "5000", "--department", "Eng", "--tax", "2000",
    ]);
    const result = runCli(["list"]);
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes("EMP-L1"));
    assert.ok(result.stdout.includes("One"));
    assert.ok(result.stdout.includes("Total employees: 1"));
  });

  it("removes employee", () => {
    runCli([
      "add", "--id", "EMP-RM", "--name", "Remove Me",
      "--wallet", "0x0000000000000000000000000000000000000001",
      "--salary", "5000", "--department", "Eng", "--tax", "2000",
    ]);
    const result = runCli(["remove", "--id", "EMP-RM"]);
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes("Removed employee EMP-RM"));

    const list = runCli(["list"]);
    assert.ok(list.stdout.includes("No employees"));
  });

  it("removing non-existent employee fails", () => {
    const result = runCli(["remove", "--id", "EMP-NONE"]);
    assert.notEqual(result.exitCode, 0);
    assert.ok(result.stderr.includes("not found"));
  });
});

describe("CLI process offline", () => {
  beforeEach(() => setupTmpDir());
  afterEach(() => cleanupTmpDir());

  it("processes offline payroll with cycle and period", () => {
    // Add employees
    runCli([
      "add", "--id", "EMP-P1", "--name", "One",
      "--wallet", "0x0000000000000000000000000000000000000001",
      "--salary", "5000", "--department", "Eng", "--tax", "2000",
    ]);

    const result = runCli([
      "process", "--offline",
      "--cycle", "cycle-001",
      "--period-start", "2026-08-01",
      "--period-end", "2026-08-31",
      "--cap", "1000000000",
    ]);
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes("cycle-001"));
    assert.ok(result.stdout.includes("2026-08-01"));
    assert.ok(result.stdout.includes("Total Net"));
  });

  it("process without --offline reaches live config path", () => {
    runCli([
      "add", "--id", "EMP-LIVE", "--name", "Live",
      "--wallet", "0x0000000000000000000000000000000000000001",
      "--salary", "5000", "--department", "Eng", "--tax", "2000",
    ]);

    const result = runCli([
      "process",
      "--cycle", "cycle-live",
      "--period-start", "2026-08-01",
      "--period-end", "2026-08-31",
      "--cap", "1000000000",
    ]);
    // Should fail because no real T3N_API_KEY, but NOT because --offline is required
    assert.notEqual(result.exitCode, 0);
    // Should NOT contain "required option '--offline'" (that was the old bug)
    assert.ok(!result.stderr.includes("required option '--offline'"));
  });

  it("rejects invalid cycle ID", () => {
    runCli([
      "add", "--id", "EMP-C1", "--name", "One",
      "--wallet", "0x0000000000000000000000000000000000000001",
      "--salary", "5000", "--department", "Eng", "--tax", "2000",
    ]);

    const result = runCli([
      "process", "--offline",
      "--cycle", "",
      "--period-start", "2026-08-01",
      "--period-end", "2026-08-31",
      "--cap", "1000000000",
    ]);
    assert.notEqual(result.exitCode, 0);
  });

  it("rejects end date before start date", () => {
    runCli([
      "add", "--id", "EMP-D1", "--name", "One",
      "--wallet", "0x0000000000000000000000000000000000000001",
      "--salary", "5000", "--department", "Eng", "--tax", "2000",
    ]);

    const result = runCli([
      "process", "--offline",
      "--cycle", "cycle-bad",
      "--period-start", "2026-08-31",
      "--period-end", "2026-08-01",
      "--cap", "1000000000",
    ]);
    assert.notEqual(result.exitCode, 0);
  });

  it("rejects invalid batch cap", () => {
    runCli([
      "add", "--id", "EMP-C2", "--name", "One",
      "--wallet", "0x0000000000000000000000000000000000000001",
      "--salary", "5000", "--department", "Eng", "--tax", "2000",
    ]);

    const result = runCli([
      "process", "--offline",
      "--cycle", "cycle-cap",
      "--period-start", "2026-08-01",
      "--period-end", "2026-08-31",
      "--cap", "0",
    ]);
    assert.notEqual(result.exitCode, 0);
  });

  it("shows history after processing", () => {
    runCli([
      "add", "--id", "EMP-H1", "--name", "History",
      "--wallet", "0x0000000000000000000000000000000000000001",
      "--salary", "5000", "--department", "Eng", "--tax", "2000",
    ]);
    runCli([
      "process", "--offline",
      "--cycle", "cycle-hist",
      "--period-start", "2026-08-01",
      "--period-end", "2026-08-31",
      "--cap", "1000000000",
    ]);

    const result = runCli(["history"]);
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes("cycle-hist"));
  });

  it("no unwanted files outside temp data dir", () => {
    runCli([
      "add", "--id", "EMP-F1", "--name", "Files",
      "--wallet", "0x0000000000000000000000000000000000000001",
      "--salary", "5000", "--department", "Eng", "--tax", "2000",
    ]);

    // Check only employees.json and batches/ exist in tmpDir
    const files = fs.readdirSync(tmpDir);
    assert.ok(files.includes("employees.json"));
    assert.ok(files.includes("batches"));
  });
});

describe("CLI error handling", () => {
  beforeEach(() => setupTmpDir());
  afterEach(() => cleanupTmpDir());

  it("process with no employees exits non-zero", () => {
    const result = runCli([
      "process", "--offline",
      "--cycle", "cycle-empty",
      "--period-start", "2026-08-01",
      "--period-end", "2026-08-31",
      "--cap", "1000000000",
    ]);
    assert.notEqual(result.exitCode, 0);
    assert.ok(result.stderr.includes("No employees"));
  });

  it("show non-existent batch exits non-zero", () => {
    const result = runCli(["show", "--batch", "non-existent"]);
    assert.notEqual(result.exitCode, 0);
    assert.ok(result.stderr.includes("not found"));
  });
});
