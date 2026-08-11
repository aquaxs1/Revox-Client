use serde::{Deserialize, Serialize};

/// Persisted launcher settings. Everything here is local to the device.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub locale: String,
    pub theme: String,
    pub accent: String,
    pub spacing: String,
    pub sidebar_expanded: bool,
    pub onboarding_complete: bool,
    pub robux_spent: i64,
    pub selected_account_id: Option<String>,
}

/// Partial settings update. Every field is optional so the UI can patch a
/// single value without reading and rewriting the whole record.
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SettingsInput {
    pub locale: Option<String>,
    pub theme: Option<String>,
    pub accent: Option<String>,
    pub spacing: Option<String>,
    pub sidebar_expanded: Option<bool>,
    pub onboarding_complete: Option<bool>,
    pub robux_spent: Option<i64>,
    pub selected_account_id: Option<Option<String>>,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
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

/// A point-in-time reading of the local machine.
///
/// Every field that cannot be measured safely stays `None` and the UI renders
/// "not available" instead of inventing a number.
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SystemSnapshot {
    pub os_name: Option<String>,
    pub cpu_name: Option<String>,
    pub cpu_cores: Option<usize>,
    pub cpu_usage_percent: Option<f32>,
    pub memory_total_bytes: Option<u64>,
    pub memory_used_bytes: Option<u64>,
    pub gpu_name: Option<String>,
    pub gpu_usage_percent: Option<f32>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LaunchRequest {
    pub place_id: String,
    pub game_id: Option<String>,
    pub account_profile_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LaunchReceipt {
    pub uri: String,
    pub activity_id: String,
    pub accepted_at: String,
}

/// Public Roblox catalog data for one place. Fetched from official Roblox
/// endpoints without any cookie or credential.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GameMetadata {
    pub place_id: String,
    pub universe_id: String,
    pub name: String,
    pub description: String,
    pub icon_url: Option<String>,
    pub playing: Option<i64>,
    pub visits: Option<i64>,
}
