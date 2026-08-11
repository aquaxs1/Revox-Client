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
    /// Playtime recording is off until the user turns it on.
    pub stats_tracking_enabled: bool,
    /// A public Roblox profile the friends screen reads. Never a login.
    pub roblox_user_id: Option<String>,
    pub roblox_username: Option<String>,
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
    pub stats_tracking_enabled: Option<bool>,
    pub roblox_user_id: Option<Option<String>>,
    pub roblox_username: Option<Option<String>>,
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
    /// Set to rejoin one specific server instead of any public server.
    pub game_instance_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LaunchReceipt {
    pub uri: String,
    pub activity_id: String,
    pub accepted_at: String,
}

/// Public Roblox catalog data for one place, used by the library.
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

// ---------------------------------------------------------------- explorer --

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RobloxUser {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub created: Option<String>,
    pub account_age_days: Option<i64>,
    pub has_verified_badge: bool,
    pub is_banned: bool,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PresenceState {
    Offline,
    Online,
    InGame,
    InStudio,
    Unknown,
}

impl From<i64> for PresenceState {
    fn from(value: i64) -> Self {
        match value {
            0 => PresenceState::Offline,
            1 => PresenceState::Online,
            2 => PresenceState::InGame,
            3 => PresenceState::InStudio,
            _ => PresenceState::Unknown,
        }
    }
}

/// Where a user is right now, as far as Roblox will tell an anonymous caller.
///
/// `place_id` and `game_instance_id` are frequently `None`: Roblox only reveals
/// them when the user's join privacy allows it. The UI shows the join button
/// only when they are actually present.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UserPresence {
    pub user_id: String,
    pub state: PresenceState,
    pub last_location: Option<String>,
    pub place_id: Option<String>,
    pub root_place_id: Option<String>,
    pub game_instance_id: Option<String>,
    pub universe_id: Option<String>,
    pub last_online: Option<String>,
}

/// A full profile view: the account plus every public counter Roblox exposes.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UserStats {
    pub user: RobloxUser,
    pub followers: Option<i64>,
    pub following: Option<i64>,
    pub friends: Option<i64>,
    pub groups: Option<i64>,
    pub presence: Option<UserPresence>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FriendEntry {
    pub user: RobloxUser,
    pub presence: Option<UserPresence>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GameStats {
    pub universe_id: String,
    pub root_place_id: String,
    pub name: String,
    pub description: String,
    pub creator_id: String,
    pub creator_name: String,
    pub creator_type: String,
    pub playing: Option<i64>,
    pub visits: Option<i64>,
    pub favorites: Option<i64>,
    pub up_votes: Option<i64>,
    pub down_votes: Option<i64>,
    pub max_players: Option<i64>,
    pub created: Option<String>,
    pub updated: Option<String>,
    pub genre: Option<String>,
    pub price: Option<i64>,
    pub icon_url: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GameSummary {
    pub universe_id: String,
    pub root_place_id: String,
    pub name: String,
    pub creator_name: String,
    pub playing: Option<i64>,
    pub up_votes: Option<i64>,
    pub down_votes: Option<i64>,
    pub icon_url: Option<String>,
}

/// One live public server of a place.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GameServer {
    pub id: String,
    pub playing: i64,
    pub max_players: i64,
    pub fps: Option<f64>,
    pub ping: Option<i64>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CatalogItem {
    pub id: String,
    pub item_type: String,
    pub name: String,
    pub description: String,
    pub creator_id: String,
    pub creator_name: String,
    pub price: Option<i64>,
    pub lowest_price: Option<i64>,
    pub favorite_count: Option<i64>,
    pub is_limited: bool,
    pub is_limited_unique: bool,
    pub units_available: Option<i64>,
    pub created: Option<String>,
    pub image_url: Option<String>,
    /// Resale figures, only present for limited items.
    pub recent_average_price: Option<i64>,
    pub original_price: Option<i64>,
    pub sales: Option<i64>,
    pub number_remaining: Option<i64>,
}
