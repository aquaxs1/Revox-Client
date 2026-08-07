use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub locale: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SettingsInput {
    pub locale: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RobloxState {
    Ready,
    NotFound,
    Running,
    CheckFailed,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RobloxStatus {
    pub state: RobloxState,
    pub installation_path: Option<String>,
    pub detail: Option<String>,
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{RobloxState, RobloxStatus};
    use crate::error::AppError;

    #[test]
    fn contracts_serialize_for_the_typescript_boundary() {
        let status = RobloxStatus {
            state: RobloxState::NotFound,
            installation_path: None,
            detail: Some("Protocol handler missing".to_string()),
        };

        assert_eq!(
            serde_json::to_value(status).unwrap(),
            json!({
                "state": "notFound",
                "installationPath": null,
                "detail": "Protocol handler missing"
            })
        );
    }

    #[test]
    fn app_errors_have_stable_code_and_message_fields() {
        let error = AppError::new("ROBLOX_NOT_FOUND", "Roblox was not found");

        assert_eq!(
            serde_json::to_value(error).unwrap(),
            json!({
                "code": "ROBLOX_NOT_FOUND",
                "message": "Roblox was not found"
            })
        );
    }
}
