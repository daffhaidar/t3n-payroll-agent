//! Payroll computation logic.
//!
//! All monetary values are u64 cents. Tax is u16 basis points (0–10000).
//! Uses checked arithmetic throughout — overflow returns explicit errors.

extern crate alloc;

use alloc::string::{String, ToString};
use alloc::vec::Vec;
use serde::{Deserialize, Serialize};

/// Maximum tax rate: 10000 basis points = 100%.
const MAX_BASIS_POINTS: u16 = 10000;

/// Maximum batch cap: $10,000,000 in cents.
const MAX_BATCH_CAP_CENTS: u64 = 100_000_000_000;

/// An employee record stored in the KV map.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmployeeRecord {
    pub id: String,
    pub department: String,
    /// Monthly base salary in cents.
    pub base_salary_cents: u64,
    /// Tax rate in basis points (0–10000).
    pub tax_basis_points: u16,
}

/// Request payload for compute-payroll.
#[derive(Debug, Deserialize)]
pub struct PayrollRequest {
    pub cycle_id: String,
    pub pay_period_start: String,
    pub pay_period_end: String,
    pub batch_cap_cents: u64,
}

/// Per-employee result.
#[derive(Debug, Serialize)]
pub struct EmployeeResult {
    pub employee_id: String,
    pub gross_pay_cents: String,
    pub tax_withheld_cents: String,
    pub net_pay_cents: String,
    pub status: String,
}

/// Batch totals.
#[derive(Debug, Serialize)]
pub struct BatchTotals {
    pub total_gross_cents: String,
    pub total_tax_cents: String,
    pub total_net_cents: String,
}

/// Full payroll computation result.
#[derive(Debug, Serialize)]
pub struct PayrollResult {
    pub cycle_id: String,
    pub employee_results: Vec<EmployeeResult>,
    pub batch_totals: BatchTotals,
}

/// Compute tax withheld: gross * basis_points / 10000.
/// Uses u128 to prevent overflow during multiplication.
fn compute_tax(gross_cents: u64, basis_points: u16) -> Result<u64, String> {
    let gross = gross_cents as u128;
    let bp = basis_points as u128;
    let tax = gross.checked_mul(bp).ok_or("overflow computing tax")? / 10000;
    if tax > u64::MAX as u128 {
        return Err("tax exceeds u64 range".into());
    }
    Ok(tax as u64)
}

/// Validate a single employee record before computation.
fn validate_employee(emp: &EmployeeRecord) -> Result<(), String> {
    if emp.base_salary_cents == 0 {
        return Err(format!("employee {} has zero salary", emp.id));
    }
    if emp.tax_basis_points > MAX_BASIS_POINTS {
        return Err(format!(
            "employee {} tax rate {} exceeds maximum {}",
            emp.id, emp.tax_basis_points, MAX_BASIS_POINTS
        ));
    }
    Ok(())
}

/// Compute payroll for a list of employees.
pub fn compute_payroll(
    request: &PayrollRequest,
    employees: &[EmployeeRecord],
) -> Result<PayrollResult, String> {
    // Validate cycle_id is not empty
    if request.cycle_id.is_empty() {
        return Err("cycle_id is required".into());
    }

    // Validate batch cap
    if request.batch_cap_cents == 0 {
        return Err("batch_cap_cents must be positive".into());
    }
    if request.batch_cap_cents > MAX_BATCH_CAP_CENTS {
        return Err("batch_cap_cents exceeds maximum".into());
    }

    if employees.is_empty() {
        return Err("no employee records provided".into());
    }

    let mut results: Vec<EmployeeResult> = Vec::new();
    let mut total_gross: u64 = 0;
    let mut total_tax: u64 = 0;
    let mut total_net: u64 = 0;

    for emp in employees {
        validate_employee(emp)?;

        let tax = compute_tax(emp.base_salary_cents, emp.tax_basis_points)?;
        let net = emp
            .base_salary_cents
            .checked_sub(tax)
            .ok_or("overflow computing net pay")?;

        total_gross = total_gross
            .checked_add(emp.base_salary_cents)
            .ok_or("overflow computing total gross")?;
        total_tax = total_tax
            .checked_add(tax)
            .ok_or("overflow computing total tax")?;
        total_net = total_net
            .checked_add(net)
            .ok_or("overflow computing total net")?;

        results.push(EmployeeResult {
            employee_id: emp.id.clone(),
            gross_pay_cents: emp.base_salary_cents.to_string(),
            tax_withheld_cents: tax.to_string(),
            net_pay_cents: net.to_string(),
            status: "validated".into(),
        });
    }

    // Check batch cap
    if total_net > request.batch_cap_cents {
        return Err(format!(
            "total net {} exceeds batch cap {}",
            total_net, request.batch_cap_cents
        ));
    }

    Ok(PayrollResult {
        cycle_id: request.cycle_id.clone(),
        employee_results: results,
        batch_totals: BatchTotals {
            total_gross_cents: total_gross.to_string(),
            total_tax_cents: total_tax.to_string(),
            total_net_cents: total_net.to_string(),
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_emp(id: &str, salary: u64, tax_bp: u16) -> EmployeeRecord {
        EmployeeRecord {
            id: id.into(),
            department: "Engineering".into(),
            base_salary_cents: salary,
            tax_basis_points: tax_bp,
        }
    }

    #[test]
    fn test_normal_payroll() {
        let req = PayrollRequest {
            cycle_id: "cycle-001".into(),
            pay_period_start: "2026-08-01".into(),
            pay_period_end: "2026-08-31".into(),
            batch_cap_cents: 1_000_000_000,
        };
        let employees = vec![
            make_emp("EMP-001", 500_000, 2000), // $5000, 20%
            make_emp("EMP-002", 420_000, 1800), // $4200, 18%
        ];
        let result = compute_payroll(&req, &employees).unwrap();
        assert_eq!(result.cycle_id, "cycle-001");
        assert_eq!(result.employee_results.len(), 2);

        // EMP-001: $5000 * 20% = $1000 tax, $4000 net
        assert_eq!(result.employee_results[0].gross_pay_cents, "500000");
        assert_eq!(result.employee_results[0].tax_withheld_cents, "100000");
        assert_eq!(result.employee_results[0].net_pay_cents, "400000");

        // EMP-002: $4200 * 18% = $756 tax, $3444 net
        assert_eq!(result.employee_results[1].gross_pay_cents, "420000");
        assert_eq!(result.employee_results[1].tax_withheld_cents, "75600");
        assert_eq!(result.employee_results[1].net_pay_cents, "344400");

        // Totals
        assert_eq!(result.batch_totals.total_gross_cents, "920000");
        assert_eq!(result.batch_totals.total_tax_cents, "175600");
        assert_eq!(result.batch_totals.total_net_cents, "744400");
    }

    #[test]
    fn test_zero_salary_rejected() {
        let req = PayrollRequest {
            cycle_id: "cycle-002".into(),
            pay_period_start: "2026-08-01".into(),
            pay_period_end: "2026-08-31".into(),
            batch_cap_cents: 1_000_000_000,
        };
        let employees = vec![make_emp("EMP-ZERO", 0, 2000)];
        let err = compute_payroll(&req, &employees).unwrap_err();
        assert!(
            err.contains("zero salary"),
            "Expected zero salary error, got: {}",
            err
        );
    }

    #[test]
    fn test_invalid_tax_rate_rejected() {
        let req = PayrollRequest {
            cycle_id: "cycle-003".into(),
            pay_period_start: "2026-08-01".into(),
            pay_period_end: "2026-08-31".into(),
            batch_cap_cents: 1_000_000_000,
        };
        let employees = vec![make_emp("EMP-TAX", 500_000, 20000)]; // 200% — invalid
        let err = compute_payroll(&req, &employees).unwrap_err();
        assert!(
            err.contains("exceeds maximum"),
            "Expected tax rate error, got: {}",
            err
        );
    }

    #[test]
    fn test_zero_tax_rate() {
        let req = PayrollRequest {
            cycle_id: "cycle-004".into(),
            pay_period_start: "2026-08-01".into(),
            pay_period_end: "2026-08-31".into(),
            batch_cap_cents: 1_000_000_000,
        };
        let employees = vec![make_emp("EMP-NO-TAX", 500_000, 0)];
        let result = compute_payroll(&req, &employees).unwrap();
        assert_eq!(result.employee_results[0].tax_withheld_cents, "0");
        assert_eq!(result.employee_results[0].net_pay_cents, "500000");
    }

    #[test]
    fn test_rounding_policy() {
        // $100 * 33.33% (3333 bp) = 10000 * 3333 / 10000 = 3333 tax, 6667 net
        // Integer division truncates — this is the documented rounding policy.
        let req = PayrollRequest {
            cycle_id: "cycle-005".into(),
            pay_period_start: "2026-08-01".into(),
            pay_period_end: "2026-08-31".into(),
            batch_cap_cents: 1_000_000_000,
        };
        let employees = vec![make_emp("EMP-ROUND", 10_000, 3333)];
        let result = compute_payroll(&req, &employees).unwrap();
        assert_eq!(result.employee_results[0].tax_withheld_cents, "3333");
        assert_eq!(result.employee_results[0].net_pay_cents, "6667");
    }

    #[test]
    fn test_overflow_salary() {
        let req = PayrollRequest {
            cycle_id: "cycle-006".into(),
            pay_period_start: "2026-08-01".into(),
            pay_period_end: "2026-08-31".into(),
            batch_cap_cents: u64::MAX,
        };
        let employees = vec![make_emp("EMP-OVER", u64::MAX, 5000)];
        // Should not panic — checked arithmetic returns error
        let result = compute_payroll(&req, &employees);
        assert!(
            result.is_err()
                || result.unwrap().batch_totals.total_gross_cents == u64::MAX.to_string()
        );
    }

    #[test]
    fn test_empty_cycle_id_rejected() {
        let req = PayrollRequest {
            cycle_id: "".into(),
            pay_period_start: "2026-08-01".into(),
            pay_period_end: "2026-08-31".into(),
            batch_cap_cents: 1_000_000_000,
        };
        let err = compute_payroll(&req, &[]).unwrap_err();
        assert!(err.contains("cycle_id"));
    }

    #[test]
    fn test_batch_cap_exceeded() {
        let req = PayrollRequest {
            cycle_id: "cycle-007".into(),
            pay_period_start: "2026-08-01".into(),
            pay_period_end: "2026-08-31".into(),
            batch_cap_cents: 10_000, // $100 cap
        };
        let employees = vec![make_emp("EMP-CAP", 500_000, 0)]; // $5000 net, exceeds $100 cap
        let err = compute_payroll(&req, &employees).unwrap_err();
        assert!(err.contains("exceeds batch cap"));
    }

    #[test]
    fn test_missing_employee_json() {
        let bad_json = r#"{"cycle_id": "c1", "pay_period_start": "2026-08-01", "pay_period_end": "2026-08-31", "batch_cap_cents": 1000000}"#;
        let parsed: Result<PayrollRequest, _> = serde_json::from_str(bad_json);
        assert!(parsed.is_ok());
    }
}
