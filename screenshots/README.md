# Screenshots

This directory contains verification screenshots for the T3N Agent Build Challenge submission.

## Required Screenshots

| # | Command | Description |
|---|---------|-------------|
| 1 | `npm run typecheck` | TypeScript strict mode — clean output |
| 2 | `npm test` | 58/58 TypeScript tests pass |
| 3 | `cargo test --manifest-path contracts/payroll/Cargo.toml` | 15/15 Rust tests pass |
| 4 | `cargo clippy --manifest-path contracts/payroll/Cargo.toml --all-targets -- -D warnings` | Clippy clean |
| 5 | `ls -lh contracts/payroll/target/wasm32-wasip2/release/z_payroll.wasm` | WASM build (190KB) |
| 6 | `npm run contract` | Contract registration + invocation attempt |
| 7 | `npx tsx src/cli.ts --help` | CLI help output |
| 8 | `npx tsx src/cli.ts list` | Employee list (salary redacted) |
| 9 | `npx tsx src/cli.ts process --offline --cycle test-001 --period-start 2026-08-01 --period-end 2026-08-31 --cap 100000000000` | Offline payroll process |

## How to Capture

```bash
# Run each command and save output
npm run typecheck 2>&1 | tee screenshots/01-typecheck.txt
npm test 2>&1 | tee screenshots/02-tests.txt
cargo test --manifest-path contracts/payroll/Cargo.toml 2>&1 | tee screenshots/03-rust-tests.txt
cargo clippy --manifest-path contracts/payroll/Cargo.toml --all-targets -- -D warnings 2>&1 | tee screenshots/04-clippy.txt
ls -lh contracts/payroll/target/wasm32-wasip2/release/z_payroll.wasm 2>&1 | tee screenshots/05-wasm.txt
npm run contract 2>&1 | tee screenshots/06-contract.txt
npx tsx src/cli.ts --help 2>&1 | tee screenshots/07-cli-help.txt
npx tsx src/cli.ts list 2>&1 | tee screenshots/08-employee-list.txt
npx tsx src/cli.ts process --offline --cycle test-001 --period-start 2026-08-01 --period-end 2026-08-31 --cap 100000000000 2>&1 | tee screenshots/09-offline-process.txt
```

## Notes

- Screenshots should show real command output, not fabricated
- Include timestamps where visible
- If registration fails, capture the exact error for BUGS.md
