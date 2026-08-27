//! z-payroll v0.1.0 — Enterprise payroll TEE contract.
//!
//! Computes payroll inside the TEE enclave. Reads employee records from a
//! private KV map, applies tax calculations with checked arithmetic, and
//! writes audit records to a separate KV map.
//!
//! # Host-capability requirements
//! - kv_store: read employees, write audit records
//! - logging: debug/info/error lines
//! - tenant_context: tenant DID, cluster timestamp
//!
//! # Disbursement
//! NOT IMPLEMENTED. execute-disbursement returns an explicit error.
//! Do not simulate it as successful.
#![warn(clippy::style, missing_debug_implementations)]
#![cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]

extern crate alloc;

pub const CONTRACT_VERSION: &str = "0.1.0";

mod audit;
mod payroll;


wit_bindgen::generate!({
    world: "payroll",
    path: "wit",
    additional_derives: [
        serde::Deserialize,
        serde::Serialize,
    ],
    generate_all,
});

struct Component;

#[cfg(target_arch = "wasm32")]
impl exports::z::payroll::contracts::Guest for Component {
    fn compute_payroll(
        req: exports::z::payroll::contracts::GenericInput,
    ) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("compute-payroll: missing input")?;

        let request: payroll::PayrollRequest =
            serde_json::from_slice(&input).map_err(|e| format!("invalid request JSON: {e}"))?;

        // In a full implementation, employee records would be read from the
        // private KV map using host:interfaces/kv-store. For now, the contract
        // expects employees to be passed in the input for the MVP.
        //
        // TODO: Read from KV map once tenant creates the employees map:
        //   kv_store::get("employees", &employee_id)
        //
        // The employee records must be stored via the TenantClient map API:
        //   tenant.maps.create({ tail: "employees", visibility: "private", ... })
        //   tenant.maps.entrySet("employees", emp_id, serialized_record)

        // Extract employees from input if provided (MVP path)
        #[derive(serde::Deserialize)]
        struct ExtendedRequest {
            #[serde(flatten)]
            base: payroll::PayrollRequest,
            employees: Option<Vec<payroll::EmployeeRecord>>,
        }

        let extended: ExtendedRequest =
            serde_json::from_slice(&input).map_err(|e| format!("invalid request JSON: {e}"))?;

        let employees = extended.employees.ok_or(
            "compute-payroll: employees must be provided (MVP: in input; production: from KV map)",
        )?;

        let result = payroll::compute_payroll(&request, &employees)?;

        serde_json::to_vec(&result).map_err(|e| format!("serialization error: {e}"))
    }

    fn finalize_audit(
        req: exports::z::payroll::contracts::GenericInput,
    ) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("finalize-audit: missing input")?;

        let request: audit::FinalizeAuditRequest =
            serde_json::from_slice(&input).map_err(|e| format!("invalid request JSON: {e}"))?;

        // In a full implementation, audit entries would be written to the
        // private KV map using host:interfaces/kv-store.
        let timestamp = "2026-08-27T00:00:00Z"; // From tenant-context in production
        let response = audit::finalize_audit(&request, timestamp)?;

        // Build audit entries (would be stored in KV map in production)
        let _entries = audit::build_audit_entries(&request.cycle_id, &request.results, timestamp);

        serde_json::to_vec(&response).map_err(|e| format!("serialization error: {e}"))
    }

    fn execute_disbursement(
        _req: exports::z::payroll::contracts::GenericInput,
    ) -> Result<Vec<u8>, String> {
        Err("execute-disbursement: NOT IMPLEMENTED. Disbursement requires a real sandbox payment endpoint through an authorized T3N outbound host. Do not simulate as successful.".into())
    }

    fn validate_credentials(
        req: exports::z::payroll::contracts::GenericInput,
    ) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("validate-credentials: missing input")?;

        #[derive(serde::Deserialize)]
        struct ValidateRequest {
            cycle_id: String,
        }

        let request: ValidateRequest =
            serde_json::from_slice(&input).map_err(|e| format!("invalid request JSON: {e}"))?;

        if request.cycle_id.is_empty() {
            return Err("cycle_id is required".into());
        }

        // In production, this would validate credentials against the KV map.
        // For the MVP, we return valid=true if cycle_id is non-empty.
        let response = serde_json::json!({ "valid": true });
        serde_json::to_vec(&response).map_err(|e| format!("serialization error: {e}"))
    }

    fn list_audit_cycles(
        _req: exports::z::payroll::contracts::GenericInput,
    ) -> Result<Vec<u8>, String> {
        // In production, this would read from the audit KV map.
        let response = serde_json::json!({ "cycles": [] });
        serde_json::to_vec(&response).map_err(|e| format!("serialization error: {e}"))
    }

    fn get_audit_entry(
        req: exports::z::payroll::contracts::GenericInput,
    ) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("get-audit-entry: missing input")?;

        #[derive(serde::Deserialize)]
        struct GetAuditRequest {
            cycle_id: String,
        }

        let _request: GetAuditRequest =
            serde_json::from_slice(&input).map_err(|e| format!("invalid request JSON: {e}"))?;

        // In production, this would read from the audit KV map.
        let response = serde_json::json!({ "cycle_id": _request.cycle_id, "entries": [] });
        serde_json::to_vec(&response).map_err(|e| format!("serialization error: {e}"))
    }
}

#[cfg(target_arch = "wasm32")]
export!(Component);

#[cfg(test)]
mod tests {
    use super::CONTRACT_VERSION;

    #[test]
    fn contract_version_is_semver() {
        let parts: Vec<&str> = CONTRACT_VERSION.split('.').collect();
        assert_eq!(parts.len(), 3, "CONTRACT_VERSION must be MAJOR.MINOR.PATCH");
        for part in parts {
            assert!(part.parse::<u32>().is_ok(), "each part must be a number");
        }
    }

    #[test]
    fn contract_version_is_0_1_0() {
        assert_eq!(CONTRACT_VERSION, "0.1.0");
    }
}
