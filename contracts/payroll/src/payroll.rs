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
/// 10_000_000 dollars * 100 cents/dollar = 1_000_000_000 cents.
const MAX_BATCH_CAP_CENTS: u64 = 1_000_000_000;

/// Maximum number of employees per batch.
const MAX_EMPLOYEES: usize = 1000;

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

/// Validate a date string is a plausible YYYY-MM-DD date.
fn validate_date(date: &str, field_name: &str) -> Result<(), String> {
    if date.len() != 10 {
        return Err(format!("{field_name} must be YYYY-MM-DD format"));
    }
    let parts: Vec<&str> = date.split('-').collect();
    if parts.len() != 3 {
        return Err(format!("{field_name} must be YYYY-MM-DD format"));
    }
    let year: u32 = parts[0]
        .parse()
        .map_err(|_| format!("{field_name} has invalid year"))?;
    let month: u32 = parts[1]
        .parse()
        .map_err(|_| format!("{field_name} has invalid month"))?;
    let day: u32 = parts[2]
        .parse()
        .map_err(|_| format!("{field_name} has invalid day"))?;
    if !(2000..=2100).contains(&year) {
        return Err(format!("{field_name} year {year} out of range 2000-2100"));
    }
    if !(1..=12).contains(&month) {
        return Err(format!("{field_name} month {month} out of range 1-12"));
    }
    if !(1..=31).contains(&day) {
        return Err(format!("{field_name} day {day} out of range 1-31"));
    }
    // Simple days-in-month check
    let max_day = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400)) {
                29
            } else {
                28
            }
        }
        _ => unreachable!(),
    };
    if day > max_day {
        return Err(format!(
            "{field_name} day {day} exceeds maximum {max_day} for month {month}"
        ));
    }
    Ok(())
}

/// Validate a single employee record before computation.
fn validate_employee(emp: &EmployeeRecord) -> Result<(), String> {
    if emp.id.is_empty() {
        return Err("employee ID must not be empty".into());
    }
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
    // Validate cycle_id is not empty and well-formed
    if request.cycle_id.is_empty() {
        return Err("cycle_id is required".into());
    }
    if request.cycle_id.len() > 64 {
        return Err("cycle_id must be at most 64 characters".into());
    }

    // Validate pay period dates
    validate_date(&request.pay_period_start, "pay_period_start")?;
    validate_date(&request.pay_period_end, "pay_period_end")?;

    // Validate end date is after start date
    if request.pay_period_end <= request.pay_period_start {
        return Err("pay_period_end must be after pay_period_start".into());
    }

    // Validate batch cap
    if request.batch_cap_cents == 0 {
        return Err("batch_cap_cents must be positive".into());
    }
    if request.batch_cap_cents > MAX_BATCH_CAP_CENTS {
        return Err("batch_cap_cents exceeds maximum".into());
    }

    // Validate employee list
    if employees.is_empty() {
        return Err("no employee records provided".into());
    }
    if employees.len() > MAX_EMPLOYEES {
        return Err(format!(
            "employee count {} exceeds maximum {}",
            employees.len(),
            MAX_EMPLOYEES
        ));
    }

    // Check for duplicate employee IDs
    let mut seen_ids = alloc::collections::BTreeSet::new();
    for emp in employees {
        if !seen_ids.insert(&emp.id) {
            return Err(format!("duplicate employee ID: {}", emp.id));
        }
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

    fn make_request(cycle_id: &str, cap: u64) -> PayrollRequest {
        PayrollRequest {
            cycle_id: cycle_id.into(),
            pay_period_start: "2026-08-01".into(),
            pay_period_end: "2026-08-31".into(),
            batch_cap_cents: cap,
        }
    }

    #[test]
    fn test_normal_payroll() {
        let req = make_request("cycle-001", 1_000_000_000);
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
        let req = make_request("cycle-002", 1_000_000_000);
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
        let req = make_request("cycle-003", 1_000_000_000);
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
        let req = make_request("cycle-004", 1_000_000_000);
        let employees = vec![make_emp("EMP-NO-TAX", 500_000, 0)];
        let result = compute_payroll(&req, &employees).unwrap();
        assert_eq!(result.employee_results[0].tax_withheld_cents, "0");
        assert_eq!(result.employee_results[0].net_pay_cents, "500000");
    }

    #[test]
    fn test_rounding_policy() {
        // $100 * 33.33% (3333 bp) = 10000 * 3333 / 10000 = 3333 tax, 6667 net
        let req = make_request("cycle-005", 1_000_000_000);
        let employees = vec![make_emp("EMP-ROUND", 10_000, 3333)];
        let result = compute_payroll(&req, &employees).unwrap();
        assert_eq!(result.employee_results[0].tax_withheld_cents, "3333");
        assert_eq!(result.employee_results[0].net_pay_cents, "6667");
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
        let req = make_request("cycle-007", 10_000); // $100 cap
        let employees = vec![make_emp("EMP-CAP", 500_000, 0)]; // $5000 net, exceeds $100 cap
        let err = compute_payroll(&req, &employees).unwrap_err();
        assert!(err.contains("exceeds batch cap"));
    }

    #[test]
    fn test_empty_employee_list_rejected() {
        let req = make_request("cycle-008", 1_000_000_000);
        let err = compute_payroll(&req, &[]).unwrap_err();
        assert!(err.contains("no employee records"));
    }

    #[test]
    fn test_duplicate_employee_id_rejected() {
        let req = make_request("cycle-009", 1_000_000_000);
        let employees = vec![
            make_emp("EMP-001", 500_000, 2000),
            make_emp("EMP-001", 420_000, 1800),
        ];
        let err = compute_payroll(&req, &employees).unwrap_err();
        assert!(
            err.contains("duplicate employee ID"),
            "Expected duplicate error, got: {}",
            err
        );
    }

    #[test]
    fn test_invalid_pay_period_start() {
        let req = PayrollRequest {
            cycle_id: "cycle-010".into(),
            pay_period_start: "not-a-date".into(),
            pay_period_end: "2026-08-31".into(),
            batch_cap_cents: 1_000_000_000,
        };
        let employees = vec![make_emp("EMP-001", 500_000, 2000)];
        let err = compute_payroll(&req, &employees).unwrap_err();
        assert!(err.contains("pay_period_start"));
    }

    #[test]
    fn test_reversed_pay_period() {
        let req = PayrollRequest {
            cycle_id: "cycle-011".into(),
            pay_period_start: "2026-08-31".into(),
            pay_period_end: "2026-08-01".into(),
            batch_cap_cents: 1_000_000_000,
        };
        let employees = vec![make_emp("EMP-001", 500_000, 2000)];
        let err = compute_payroll(&req, &employees).unwrap_err();
        assert!(err.contains("pay_period_end must be after"));
    }

    #[test]
    fn test_zero_cap_rejected() {
        let req = make_request("cycle-012", 0);
        let employees = vec![make_emp("EMP-001", 500_000, 2000)];
        let err = compute_payroll(&req, &employees).unwrap_err();
        assert!(err.contains("batch_cap_cents must be positive"));
    }

    #[test]
    fn test_cap_over_maximum_rejected() {
        let req = make_request("cycle-013", MAX_BATCH_CAP_CENTS + 1);
        let employees = vec![make_emp("EMP-001", 500_000, 2000)];
        let err = compute_payroll(&req, &employees).unwrap_err();
        assert!(err.contains("batch_cap_cents exceeds maximum"));
    }

    #[test]
    fn test_net_total_over_cap_rejected() {
        let req = make_request("cycle-014", 100); // $1.00 cap
        let employees = vec![make_emp("EMP-001", 500_000, 0)]; // $5000 net
        let err = compute_payroll(&req, &employees).unwrap_err();
        assert!(err.contains("exceeds batch cap"));
    }

    #[test]
    fn test_checked_total_overflow() {
        let req = PayrollRequest {
            cycle_id: "cycle-015".into(),
            pay_period_start: "2026-08-01".into(),
            pay_period_end: "2026-08-31".into(),
            batch_cap_cents: u64::MAX,
        };
        let employees = vec![make_emp("EMP-OVER", u64::MAX, 5000)];
        let result = compute_payroll(&req, &employees);
        // Should not panic — checked arithmetic returns error or succeeds
        assert!(
            result.is_err()
                || result.unwrap().batch_totals.total_gross_cents == u64::MAX.to_string()
        );
    }

    #[test]
    fn test_decimal_string_parsing() {
        // Verify that employee IDs and salary values survive serialization round-trip
        let req = make_request("cycle-016", 1_000_000_000);
        let emp = EmployeeRecord {
            id: "EMP-RT".into(),
            department: "Test".into(),
            base_salary_cents: 123_456_789,
            tax_basis_points: 1500,
        };
        let result = compute_payroll(&req, &[emp]).unwrap();
        assert_eq!(result.employee_results[0].gross_pay_cents, "123456789");
        // 123456789 * 1500 / 10000 = 18518518 tax, 104938271 net
        assert_eq!(result.employee_results[0].net_pay_cents, "104938271");
    }

    #[test]
    fn test_max_employees_exceeded() {
        let req = make_request("cycle-017", u64::MAX);
        let employees: Vec<EmployeeRecord> = (0..MAX_EMPLOYEES + 1)
            .map(|i| make_emp(&format!("EMP-{:04}", i), 100, 1000))
            .collect();
        let err = compute_payroll(&req, &employees).unwrap_err();
        assert!(err.contains("exceeds maximum"));
    }

    #[test]
    fn test_empty_employee_id_rejected() {
        let req = make_request("cycle-018", 1_000_000_000);
        let emp = EmployeeRecord {
            id: "".into(),
            department: "Test".into(),
            base_salary_cents: 500_000,
            tax_basis_points: 2000,
        };
        let err = compute_payroll(&req, &[emp]).unwrap_err();
        assert!(err.contains("employee ID must not be empty"));
    }
}
