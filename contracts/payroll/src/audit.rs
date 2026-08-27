//! Audit record management.
//!
//! Writes finalized payroll audit records to a private KV map.
//! Each audit entry is a JSON-serialized AuditEntry stored under
//! the key `audit:{cycle_id}`.

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use serde::{Deserialize, Serialize};

/// A single audit entry for a payroll cycle.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub cycle_id: String,
    pub employee_id: String,
    pub gross_pay_cents: String,
    pub tax_withheld_cents: String,
    pub net_pay_cents: String,
    pub status: String,
    pub finalized_at: String,
}

/// Request payload for finalize-audit.
#[derive(Debug, Deserialize)]
pub struct FinalizeAuditRequest {
    pub cycle_id: String,
    pub results: Vec<AuditResultInput>,
}

/// Employee result input for audit finalization.
#[derive(Debug, Deserialize)]
pub struct AuditResultInput {
    pub employee_id: String,
    pub gross_pay_cents: String,
    pub tax_withheld_cents: String,
    pub net_pay_cents: String,
    pub status: String,
}

/// Response from finalize-audit.
#[derive(Debug, Serialize)]
pub struct FinalizeAuditResponse {
    pub cycle_id: String,
    pub finalized: bool,
    pub audit_entry_count: usize,
}

/// Finalize audit for a completed payroll cycle.
pub fn finalize_audit(
    request: &FinalizeAuditRequest,
    _timestamp: &str,
) -> Result<FinalizeAuditResponse, String> {
    if request.cycle_id.is_empty() {
        return Err("cycle_id is required for audit finalization".into());
    }

    if request.results.is_empty() {
        return Err("no results to finalize".into());
    }

    let entry_count = request.results.len();

    Ok(FinalizeAuditResponse {
        cycle_id: request.cycle_id.clone(),
        finalized: true,
        audit_entry_count: entry_count,
    })
}

/// Build audit entries from payroll results for storage.
pub fn build_audit_entries(
    cycle_id: &str,
    results: &[AuditResultInput],
    timestamp: &str,
) -> Vec<AuditEntry> {
    results
        .iter()
        .map(|r| AuditEntry {
            cycle_id: cycle_id.into(),
            employee_id: r.employee_id.clone(),
            gross_pay_cents: r.gross_pay_cents.clone(),
            tax_withheld_cents: r.tax_withheld_cents.clone(),
            net_pay_cents: r.net_pay_cents.clone(),
            status: r.status.clone(),
            finalized_at: timestamp.into(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_finalize_audit_normal() {
        let req = FinalizeAuditRequest {
            cycle_id: "cycle-001".into(),
            results: vec![
                AuditResultInput {
                    employee_id: "EMP-001".into(),
                    gross_pay_cents: "500000".into(),
                    tax_withheld_cents: "100000".into(),
                    net_pay_cents: "400000".into(),
                    status: "validated".into(),
                },
                AuditResultInput {
                    employee_id: "EMP-002".into(),
                    gross_pay_cents: "420000".into(),
                    tax_withheld_cents: "75600".into(),
                    net_pay_cents: "344400".into(),
                    status: "validated".into(),
                },
            ],
        };
        let resp = finalize_audit(&req, "2026-08-27T00:00:00Z").unwrap();
        assert_eq!(resp.cycle_id, "cycle-001");
        assert!(resp.finalized);
        assert_eq!(resp.audit_entry_count, 2);
    }

    #[test]
    fn test_finalize_audit_empty_cycle_rejected() {
        let req = FinalizeAuditRequest {
            cycle_id: "".into(),
            results: vec![AuditResultInput {
                employee_id: "EMP-001".into(),
                gross_pay_cents: "500000".into(),
                tax_withheld_cents: "100000".into(),
                net_pay_cents: "400000".into(),
                status: "validated".into(),
            }],
        };
        let err = finalize_audit(&req, "2026-08-27T00:00:00Z").unwrap_err();
        assert!(err.contains("cycle_id"));
    }

    #[test]
    fn test_finalize_audit_no_results_rejected() {
        let req = FinalizeAuditRequest {
            cycle_id: "cycle-002".into(),
            results: vec![],
        };
        let err = finalize_audit(&req, "2026-08-27T00:00:00Z").unwrap_err();
        assert!(err.contains("no results"));
    }

    #[test]
    fn test_build_audit_entries() {
        let results = vec![AuditResultInput {
            employee_id: "EMP-001".into(),
            gross_pay_cents: "500000".into(),
            tax_withheld_cents: "100000".into(),
            net_pay_cents: "400000".into(),
            status: "validated".into(),
        }];
        let entries = build_audit_entries("cycle-001", &results, "2026-08-27T00:00:00Z");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].cycle_id, "cycle-001");
        assert_eq!(entries[0].employee_id, "EMP-001");
        assert_eq!(entries[0].finalized_at, "2026-08-27T00:00:00Z");
    }
}
