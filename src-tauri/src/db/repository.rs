use std::sync::Mutex;

use chrono::Utc;
use rusqlite::{params, types::Type, Connection, Row};
use serde::{Deserialize, Serialize};

use crate::{
    contracts::{AppSettings, SettingsInput},
    db::migrations::apply_migrations,
    error::AppError,
};

const APP_PROFILE: &str = "default";

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccountInput {
    pub id: Option<String>,
    pub username: String,
    pub label: String,
    pub color: String,
    pub note: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccountProfile {
    pub id: String,
    pub username: String,
    pub label: String,
    pub initials: String,
    pub color: String,
    pub note: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GameInput {
    pub id: Option<String>,
    pub place_id: String,
    pub name: String,
    pub description: String,
    pub image_url: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    pub id: String,
    pub place_id: String,
    pub name: String,
    pub description: String,
    pub image_url: Option<String>,
    pub tags: Vec<String>,
    pub universe_id: Option<String>,
    pub playing: Option<i64>,
    pub visits: Option<i64>,
    pub last_launched_at: Option<String>,
}

/// Per-account library facts: whether the game is bookmarked and how long this
/// profile has played it.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccountGame {
    pub account_profile_id: String,
    pub game_id: String,
    pub favorite: bool,
    pub play_time_seconds: i64,
    pub last_played_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StartedSession {
    pub account_profile_id: Option<String>,
    pub game_id: Option<String>,
    pub place_id: Option<String>,
    pub started_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FinishedSession {
    pub id: Option<String>,
    pub account_profile_id: Option<String>,
    pub game_id: Option<String>,
    pub place_id: Option<String>,
    pub started_at: String,
    pub ended_at: String,
    pub duration_seconds: i64,
    pub possible_crash: bool,
    pub source: String,
    pub game_instance_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub account_profile_id: Option<String>,
    pub game_id: Option<String>,
    pub place_id: Option<String>,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_seconds: Option<i64>,
    pub result: String,
    pub possible_crash: bool,
    pub source: String,
    pub game_instance_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActivityInput {
    pub account_profile_id: Option<String>,
    pub game_id: Option<String>,
    pub kind: String,
    pub status: String,
    pub message: String,
    pub error_code: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    pub id: String,
    pub account_profile_id: Option<String>,
    pub game_id: Option<String>,
    pub kind: String,
    pub status: String,
    pub message: String,
    pub error_code: Option<String>,
    pub created_at: String,
}

/// A profile, experience or catalog item the user follows in the stats viewer.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistEntry {
    pub id: String,
    pub kind: String,
    pub target_id: String,
    pub label: String,
    pub image_url: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistInput {
    pub kind: String,
    pub target_id: String,
    pub label: String,
    pub image_url: Option<String>,
}

/// Everything the UI needs for a cold start, in one round trip.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppBootstrap {
    pub settings: AppSettings,
    pub accounts: Vec<AccountProfile>,
    pub games: Vec<Game>,
    pub account_games: Vec<AccountGame>,
    pub sessions: Vec<Session>,
    pub activities: Vec<Activity>,
    pub watchlist: Vec<WatchlistEntry>,
}

pub trait Repository: Send + Sync {
    fn bootstrap(&self) -> Result<AppBootstrap, AppError>;
    fn settings(&self) -> Result<AppSettings, AppError>;
    fn save_settings(&self, input: SettingsInput) -> Result<AppSettings, AppError>;
    fn upsert_account(&self, input: AccountInput) -> Result<AccountProfile, AppError>;
    fn delete_account(&self, id: &str, keep_stats: bool) -> Result<(), AppError>;
    fn upsert_game(&self, input: GameInput) -> Result<Game, AppError>;
    fn delete_game(&self, id: &str) -> Result<(), AppError>;
    fn set_favorite(
        &self,
        account_profile_id: &str,
        game_id: &str,
        favorite: bool,
    ) -> Result<AccountGame, AppError>;
    fn update_metadata(
        &self,
        game_id: &str,
        metadata: &crate::contracts::GameMetadata,
    ) -> Result<Game, AppError>;
    fn record_activity(&self, input: ActivityInput) -> Result<Activity, AppError>;
    fn finish_session(&self, input: FinishedSession) -> Result<Session, AppError>;
    fn list_sessions(&self) -> Result<Vec<Session>, AppError>;
    fn add_to_watchlist(&self, input: WatchlistInput) -> Result<WatchlistEntry, AppError>;
    fn remove_from_watchlist(&self, id: &str) -> Result<(), AppError>;
    fn list_watchlist(&self) -> Result<Vec<WatchlistEntry>, AppError>;
}

pub struct SqliteRepository {
    connection: Mutex<Connection>,
}

impl SqliteRepository {
    pub fn open(path: impl AsRef<std::path::Path>) -> Result<Self, AppError> {
        let connection = Connection::open(path).map_err(database_error)?;
        Self::from_connection(connection)
    }

    pub fn in_memory() -> Result<Self, AppError> {
        let connection = Connection::open_in_memory().map_err(database_error)?;
        Self::from_connection(connection)
    }

    pub fn from_connection(mut connection: Connection) -> Result<Self, AppError> {
        apply_migrations(&mut connection)?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }
}

/// Derives up to two uppercase initials from a display name.
///
/// Kept next to the repository because it is the only place a stored account
/// gets its avatar text, and it must stay stable across edits.
pub fn initials_for(username: &str, label: &str) -> String {
    let source = if username.trim().is_empty() {
        label
    } else {
        username
    };
    let letters: Vec<String> = source
        .split_whitespace()
        .filter_map(|word| word.chars().next())
        .map(|character| character.to_uppercase().to_string())
        .collect();

    match letters.len() {
        0 => "?".to_string(),
        1 => source
            .chars()
            .filter(|character| character.is_alphanumeric())
            .take(2)
            .collect::<String>()
            .to_uppercase(),
        _ => letters[..2].concat(),
    }
}

impl Repository for SqliteRepository {
    fn bootstrap(&self) -> Result<AppBootstrap, AppError> {
        let connection = self.connection.lock().map_err(lock_error)?;
        let settings = read_settings(&connection)?;
        let accounts = collect_rows(
            &connection,
            "SELECT id, username, label, initials, color, note, avatar_url
             FROM account_profiles WHERE app_profile_id = ?1 ORDER BY created_at, id",
            account_from_row,
        )?;
        let games = collect_rows(
            &connection,
            "SELECT id, place_id, name, description, image_url, tags_json,
                    universe_id, playing, visits, last_launched_at
             FROM games WHERE app_profile_id = ?1 ORDER BY created_at, id",
            game_from_row,
        )?;
        let account_games = collect_rows(
            &connection,
            "SELECT ag.account_profile_id, ag.game_id, ag.favorite,
                    ag.play_time_seconds, ag.last_played_at
             FROM account_games ag
             JOIN account_profiles ap ON ap.id = ag.account_profile_id
             WHERE ap.app_profile_id = ?1",
            account_game_from_row,
        )?;
        let sessions = collect_rows(
            &connection,
            "SELECT id, account_profile_id, game_id, place_id, started_at, ended_at,
                    duration_seconds, result, possible_crash, source, game_instance_id
             FROM sessions WHERE app_profile_id = ?1 ORDER BY started_at DESC, id
             LIMIT 500",
            session_from_row,
        )?;
        let activities = collect_rows(
            &connection,
            "SELECT id, account_profile_id, game_id, kind, status, message, error_code, created_at
             FROM activities WHERE app_profile_id = ?1 ORDER BY created_at DESC, id
             LIMIT 100",
            activity_from_row,
        )?;

        let watchlist = collect_rows(
            &connection,
            "SELECT id, kind, target_id, label, image_url, created_at
             FROM watchlist WHERE app_profile_id = ?1 ORDER BY created_at DESC, id",
            watchlist_from_row,
        )?;

        Ok(AppBootstrap {
            settings,
            accounts,
            games,
            account_games,
            sessions,
            activities,
            watchlist,
        })
    }

    fn settings(&self) -> Result<AppSettings, AppError> {
        let connection = self.connection.lock().map_err(lock_error)?;
        read_settings(&connection)
    }

    fn save_settings(&self, input: SettingsInput) -> Result<AppSettings, AppError> {
        if let Some(locale) = &input.locale {
            if !matches!(locale.as_str(), "de" | "en") {
                return Err(AppError::new("INVALID_LOCALE", "Locale must be de or en"));
            }
        }
        if let Some(theme) = &input.theme {
            if !matches!(theme.as_str(), "dark" | "light" | "system") {
                return Err(AppError::new(
                    "INVALID_THEME",
                    "Theme must be dark, light or system",
                ));
            }
        }
        if let Some(spacing) = &input.spacing {
            if !matches!(spacing.as_str(), "compact" | "comfortable" | "spacious") {
                return Err(AppError::new(
                    "INVALID_SPACING",
                    "Spacing must be compact, comfortable or spacious",
                ));
            }
        }
        if let Some(accent) = &input.accent {
            if !valid_hex_color(accent) {
                return Err(AppError::new(
                    "INVALID_ACCENT",
                    "Accent must be a #RRGGBB hex color",
                ));
            }
        }
        if let Some(robux) = input.robux_spent {
            if robux < 0 {
                return Err(AppError::new(
                    "INVALID_ROBUX",
                    "Recorded Robux must not be negative",
                ));
            }
        }

        let connection = self.connection.lock().map_err(lock_error)?;
        let mut current = read_settings(&connection)?;
        if let Some(value) = input.locale {
            current.locale = value;
        }
        if let Some(value) = input.theme {
            current.theme = value;
        }
        if let Some(value) = input.accent {
            current.accent = value.to_uppercase();
        }
        if let Some(value) = input.spacing {
            current.spacing = value;
        }
        if let Some(value) = input.sidebar_expanded {
            current.sidebar_expanded = value;
        }
        if let Some(value) = input.onboarding_complete {
            current.onboarding_complete = value;
        }
        if let Some(value) = input.robux_spent {
            current.robux_spent = value;
        }
        if let Some(value) = input.selected_account_id {
            current.selected_account_id = value;
        }
        if let Some(value) = input.stats_tracking_enabled {
            current.stats_tracking_enabled = value;
        }
        if let Some(value) = input.roblox_user_id {
            if let Some(id) = &value {
                if !crate::api::valid_id(id) {
                    return Err(AppError::new(
                        "INVALID_ROBLOX_ID",
                        "A Roblox user ID must contain 1 to 20 digits",
                    ));
                }
            }
            current.roblox_user_id = value;
        }
        if let Some(value) = input.roblox_username {
            current.roblox_username = value;
        }

        connection
            .execute(
                "UPDATE settings SET locale = ?2, theme = ?3, accent = ?4, spacing = ?5,
                   sidebar_expanded = ?6, onboarding_complete = ?7, robux_spent = ?8,
                   selected_account_id = ?9, stats_tracking_enabled = ?10,
                   roblox_user_id = ?11, roblox_username = ?12,
                   updated_at = CURRENT_TIMESTAMP
                 WHERE app_profile_id = ?1",
                params![
                    APP_PROFILE,
                    current.locale,
                    current.theme,
                    current.accent,
                    current.spacing,
                    current.sidebar_expanded,
                    current.onboarding_complete,
                    current.robux_spent,
                    current.selected_account_id,
                    current.stats_tracking_enabled,
                    current.roblox_user_id,
                    current.roblox_username
                ],
            )
            .map_err(database_error)?;
        Ok(current)
    }

    fn upsert_account(&self, input: AccountInput) -> Result<AccountProfile, AppError> {
        let username = input.username.trim().to_string();
        if username.is_empty() || username.chars().count() > 40 {
            return Err(AppError::new(
                "INVALID_USERNAME",
                "Username must contain 1 to 40 characters",
            ));
        }
        if !valid_hex_color(&input.color) {
            return Err(AppError::new(
                "INVALID_COLOR",
                "Color must be a #RRGGBB hex color",
            ));
        }
        let label = input.label.trim().to_string();
        let initials = initials_for(&username, &label);
        let id = input.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let connection = self.connection.lock().map_err(lock_error)?;
        connection
            .execute(
                "INSERT INTO account_profiles
                   (id, app_profile_id, username, label, initials, color, note, avatar_url)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                 ON CONFLICT(id) DO UPDATE SET
                   username = excluded.username,
                   label = excluded.label,
                   initials = excluded.initials,
                   color = excluded.color,
                   note = excluded.note,
                   avatar_url = excluded.avatar_url,
                   updated_at = CURRENT_TIMESTAMP",
                params![
                    id,
                    APP_PROFILE,
                    username,
                    label,
                    initials,
                    input.color.to_uppercase(),
                    input.note,
                    input.avatar_url
                ],
            )
            .map_err(database_error)?;
        connection
            .query_row(
                "SELECT id, username, label, initials, color, note, avatar_url
                 FROM account_profiles WHERE id = ?1",
                [&id],
                account_from_row,
            )
            .map_err(database_error)
    }

    fn delete_account(&self, id: &str, keep_stats: bool) -> Result<(), AppError> {
        let mut connection = self.connection.lock().map_err(lock_error)?;
        let transaction = connection.transaction().map_err(database_error)?;
        if keep_stats {
            transaction
                .execute(
                    "UPDATE sessions SET account_profile_id = NULL WHERE account_profile_id = ?1",
                    [id],
                )
                .map_err(database_error)?;
        } else {
            transaction
                .execute("DELETE FROM sessions WHERE account_profile_id = ?1", [id])
                .map_err(database_error)?;
        }
        let deleted = transaction
            .execute("DELETE FROM account_profiles WHERE id = ?1", [id])
            .map_err(database_error)?;
        if deleted == 0 {
            return Err(AppError::new(
                "ACCOUNT_NOT_FOUND",
                "Account profile not found",
            ));
        }
        transaction.commit().map_err(database_error)
    }

    fn upsert_game(&self, input: GameInput) -> Result<Game, AppError> {
        if !crate::roblox::valid_place_id(&input.place_id) {
            return Err(AppError::new(
                "INVALID_PLACE_ID",
                "Place ID must contain 1 to 20 ASCII digits",
            ));
        }
        let tags = normalize_tags(&input.tags);
        let tags_json = serde_json::to_string(&tags)
            .map_err(|error| AppError::new("INVALID_TAGS", error.to_string()))?;
        let connection = self.connection.lock().map_err(lock_error)?;

        // Adding the same place twice must update the existing row rather than
        // trip the (app_profile_id, place_id) unique constraint.
        let existing: Option<String> = connection
            .query_row(
                "SELECT id FROM games WHERE app_profile_id = ?1 AND place_id = ?2",
                params![APP_PROFILE, input.place_id],
                |row| row.get(0),
            )
            .ok();
        let id = input
            .id
            .or(existing)
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        connection
            .execute(
                "INSERT INTO games
                   (id, app_profile_id, place_id, name, description, image_url, tags_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(id) DO UPDATE SET
                   place_id = excluded.place_id,
                   name = excluded.name,
                   description = excluded.description,
                   image_url = excluded.image_url,
                   tags_json = excluded.tags_json,
                   updated_at = CURRENT_TIMESTAMP",
                params![
                    id,
                    APP_PROFILE,
                    input.place_id,
                    input.name.trim(),
                    input.description,
                    input.image_url,
                    tags_json
                ],
            )
            .map_err(database_error)?;
        read_game(&connection, &id)
    }

    fn delete_game(&self, id: &str) -> Result<(), AppError> {
        let connection = self.connection.lock().map_err(lock_error)?;
        let deleted = connection
            .execute("DELETE FROM games WHERE id = ?1", [id])
            .map_err(database_error)?;
        if deleted == 0 {
            return Err(AppError::new("GAME_NOT_FOUND", "Game not found"));
        }
        Ok(())
    }

    fn set_favorite(
        &self,
        account_profile_id: &str,
        game_id: &str,
        favorite: bool,
    ) -> Result<AccountGame, AppError> {
        let connection = self.connection.lock().map_err(lock_error)?;
        connection
            .execute(
                "INSERT INTO account_games (account_profile_id, game_id, favorite)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(account_profile_id, game_id) DO UPDATE SET
                   favorite = excluded.favorite",
                params![account_profile_id, game_id, favorite],
            )
            .map_err(database_error)?;
        connection
            .query_row(
                "SELECT account_profile_id, game_id, favorite, play_time_seconds, last_played_at
                 FROM account_games WHERE account_profile_id = ?1 AND game_id = ?2",
                params![account_profile_id, game_id],
                account_game_from_row,
            )
            .map_err(database_error)
    }

    fn update_metadata(
        &self,
        game_id: &str,
        metadata: &crate::contracts::GameMetadata,
    ) -> Result<Game, AppError> {
        let connection = self.connection.lock().map_err(lock_error)?;
        connection
            .execute(
                "UPDATE games SET name = ?2, description = ?3, image_url = ?4,
                   universe_id = ?5, playing = ?6, visits = ?7,
                   metadata_synced_at = ?8, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?1",
                params![
                    game_id,
                    metadata.name,
                    metadata.description,
                    metadata.icon_url,
                    metadata.universe_id,
                    metadata.playing,
                    metadata.visits,
                    Utc::now().to_rfc3339()
                ],
            )
            .map_err(database_error)?;
        read_game(&connection, game_id)
    }

    fn record_activity(&self, input: ActivityInput) -> Result<Activity, AppError> {
        if !matches!(input.status.as_str(), "success" | "error" | "info") {
            return Err(AppError::new(
                "INVALID_ACTIVITY_STATUS",
                "Activity status must be success, error or info",
            ));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let created_at = Utc::now().to_rfc3339();
        let connection = self.connection.lock().map_err(lock_error)?;
        connection
            .execute(
                "INSERT INTO activities
                   (id, app_profile_id, account_profile_id, game_id, kind, status, message,
                    error_code, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    id,
                    APP_PROFILE,
                    input.account_profile_id,
                    input.game_id,
                    input.kind,
                    input.status,
                    input.message,
                    input.error_code,
                    created_at
                ],
            )
            .map_err(database_error)?;
        Ok(Activity {
            id,
            account_profile_id: input.account_profile_id,
            game_id: input.game_id,
            kind: input.kind,
            status: input.status,
            message: input.message,
            error_code: input.error_code,
            created_at,
        })
    }

    fn finish_session(&self, input: FinishedSession) -> Result<Session, AppError> {
        if input.duration_seconds < 0 {
            return Err(AppError::new(
                "INVALID_SESSION_DURATION",
                "Session duration must not be negative",
            ));
        }
        if !matches!(input.source.as_str(), "revox" | "manual") {
            return Err(AppError::new(
                "INVALID_SESSION_SOURCE",
                "Session source must be revox or manual",
            ));
        }
        let id = input.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let result = if input.possible_crash {
            "possibleCrash"
        } else {
            "completed"
        };
        let mut connection = self.connection.lock().map_err(lock_error)?;
        let transaction = connection.transaction().map_err(database_error)?;
        transaction
            .execute(
                "INSERT INTO sessions
                   (id, app_profile_id, account_profile_id, game_id, place_id, started_at,
                    ended_at, duration_seconds, result, possible_crash, source,
                    game_instance_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![
                    id,
                    APP_PROFILE,
                    input.account_profile_id,
                    input.game_id,
                    input.place_id,
                    input.started_at,
                    input.ended_at,
                    input.duration_seconds,
                    result,
                    input.possible_crash,
                    input.source,
                    input.game_instance_id
                ],
            )
            .map_err(database_error)?;

        if let (Some(account_id), Some(game_id)) = (&input.account_profile_id, &input.game_id) {
            transaction
                .execute(
                    "INSERT INTO account_games
                       (account_profile_id, game_id, play_time_seconds, last_played_at)
                     VALUES (?1, ?2, ?3, ?4)
                     ON CONFLICT(account_profile_id, game_id) DO UPDATE SET
                       play_time_seconds = play_time_seconds + excluded.play_time_seconds,
                       last_played_at = excluded.last_played_at",
                    params![account_id, game_id, input.duration_seconds, input.ended_at],
                )
                .map_err(database_error)?;
        }
        if let Some(game_id) = &input.game_id {
            transaction
                .execute(
                    "UPDATE games SET last_launched_at = ?1, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?2",
                    params![input.ended_at, game_id],
                )
                .map_err(database_error)?;
        }
        transaction.commit().map_err(database_error)?;

        Ok(Session {
            id,
            account_profile_id: input.account_profile_id,
            game_id: input.game_id,
            place_id: input.place_id,
            started_at: input.started_at,
            ended_at: Some(input.ended_at),
            duration_seconds: Some(input.duration_seconds),
            result: result.to_string(),
            possible_crash: input.possible_crash,
            source: input.source,
            game_instance_id: input.game_instance_id,
        })
    }

    fn add_to_watchlist(&self, input: WatchlistInput) -> Result<WatchlistEntry, AppError> {
        if !matches!(input.kind.as_str(), "user" | "game" | "asset") {
            return Err(AppError::new(
                "INVALID_WATCHLIST_KIND",
                "Watchlist kind must be user, game or asset",
            ));
        }
        if !crate::api::valid_id(&input.target_id) {
            return Err(AppError::new(
                "INVALID_ROBLOX_ID",
                "A Roblox ID must contain 1 to 20 digits",
            ));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let created_at = Utc::now().to_rfc3339();
        let connection = self.connection.lock().map_err(lock_error)?;

        // Following the same target twice keeps the original entry and simply
        // refreshes its label and picture.
        connection
            .execute(
                "INSERT INTO watchlist
                   (id, app_profile_id, kind, target_id, label, image_url, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(app_profile_id, kind, target_id) DO UPDATE SET
                   label = excluded.label,
                   image_url = excluded.image_url",
                params![
                    id,
                    APP_PROFILE,
                    input.kind,
                    input.target_id,
                    input.label.trim(),
                    input.image_url,
                    created_at
                ],
            )
            .map_err(database_error)?;

        connection
            .query_row(
                "SELECT id, kind, target_id, label, image_url, created_at
                 FROM watchlist WHERE app_profile_id = ?1 AND kind = ?2 AND target_id = ?3",
                params![APP_PROFILE, input.kind, input.target_id],
                watchlist_from_row,
            )
            .map_err(database_error)
    }

    fn remove_from_watchlist(&self, id: &str) -> Result<(), AppError> {
        let connection = self.connection.lock().map_err(lock_error)?;
        let deleted = connection
            .execute("DELETE FROM watchlist WHERE id = ?1", [id])
            .map_err(database_error)?;
        if deleted == 0 {
            return Err(AppError::new(
                "WATCHLIST_ENTRY_NOT_FOUND",
                "This watchlist entry no longer exists",
            ));
        }
        Ok(())
    }

    fn list_watchlist(&self) -> Result<Vec<WatchlistEntry>, AppError> {
        let connection = self.connection.lock().map_err(lock_error)?;
        collect_rows(
            &connection,
            "SELECT id, kind, target_id, label, image_url, created_at
             FROM watchlist WHERE app_profile_id = ?1 ORDER BY created_at DESC, id",
            watchlist_from_row,
        )
    }

    fn list_sessions(&self) -> Result<Vec<Session>, AppError> {
        let connection = self.connection.lock().map_err(lock_error)?;
        collect_rows(
            &connection,
            "SELECT id, account_profile_id, game_id, place_id, started_at, ended_at,
                    duration_seconds, result, possible_crash, source, game_instance_id
             FROM sessions WHERE app_profile_id = ?1 ORDER BY started_at DESC, id
             LIMIT 500",
            session_from_row,
        )
    }
}

/// Trims, lowercases and de-duplicates tags while keeping their first-seen order.
pub fn normalize_tags(tags: &[String]) -> Vec<String> {
    let mut seen = Vec::new();
    for tag in tags {
        let normalized = tag.trim().to_lowercase();
        if normalized.is_empty() || normalized.chars().count() > 24 {
            continue;
        }
        if !seen.contains(&normalized) {
            seen.push(normalized);
        }
    }
    seen
}

pub fn valid_hex_color(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 7
        && bytes[0] == b'#'
        && bytes[1..].iter().all(|byte| byte.is_ascii_hexdigit())
}

fn read_settings(connection: &Connection) -> Result<AppSettings, AppError> {
    connection
        .query_row(
            "SELECT locale, theme, accent, spacing, sidebar_expanded, onboarding_complete,
                    robux_spent, selected_account_id, stats_tracking_enabled,
                    roblox_user_id, roblox_username
             FROM settings WHERE app_profile_id = ?1",
            [APP_PROFILE],
            |row| {
                Ok(AppSettings {
                    locale: row.get(0)?,
                    theme: row.get(1)?,
                    accent: row.get(2)?,
                    spacing: row.get(3)?,
                    sidebar_expanded: row.get(4)?,
                    onboarding_complete: row.get(5)?,
                    robux_spent: row.get(6)?,
                    selected_account_id: row.get(7)?,
                    stats_tracking_enabled: row.get(8)?,
                    roblox_user_id: row.get(9)?,
                    roblox_username: row.get(10)?,
                })
            },
        )
        .map_err(database_error)
}

fn read_game(connection: &Connection, id: &str) -> Result<Game, AppError> {
    connection
        .query_row(
            "SELECT id, place_id, name, description, image_url, tags_json,
                    universe_id, playing, visits, last_launched_at
             FROM games WHERE id = ?1",
            [id],
            game_from_row,
        )
        .map_err(database_error)
}

fn collect_rows<T>(
    connection: &Connection,
    sql: &str,
    map: impl FnMut(&Row<'_>) -> rusqlite::Result<T>,
) -> Result<Vec<T>, AppError> {
    let mut statement = connection.prepare(sql).map_err(database_error)?;
    let rows = statement
        .query_map([APP_PROFILE], map)
        .map_err(database_error)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(database_error)?;
    Ok(rows)
}

fn account_from_row(row: &Row<'_>) -> rusqlite::Result<AccountProfile> {
    Ok(AccountProfile {
        id: row.get(0)?,
        username: row.get(1)?,
        label: row.get(2)?,
        initials: row.get(3)?,
        color: row.get(4)?,
        note: row.get(5)?,
        avatar_url: row.get(6)?,
    })
}

fn game_from_row(row: &Row<'_>) -> rusqlite::Result<Game> {
    let tags_json: String = row.get(5)?;
    let tags = serde_json::from_str(&tags_json).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(5, Type::Text, Box::new(error))
    })?;
    Ok(Game {
        id: row.get(0)?,
        place_id: row.get(1)?,
        name: row.get(2)?,
        description: row.get(3)?,
        image_url: row.get(4)?,
        tags,
        universe_id: row.get(6)?,
        playing: row.get(7)?,
        visits: row.get(8)?,
        last_launched_at: row.get(9)?,
    })
}

fn account_game_from_row(row: &Row<'_>) -> rusqlite::Result<AccountGame> {
    Ok(AccountGame {
        account_profile_id: row.get(0)?,
        game_id: row.get(1)?,
        favorite: row.get(2)?,
        play_time_seconds: row.get(3)?,
        last_played_at: row.get(4)?,
    })
}

fn session_from_row(row: &Row<'_>) -> rusqlite::Result<Session> {
    Ok(Session {
        id: row.get(0)?,
        account_profile_id: row.get(1)?,
        game_id: row.get(2)?,
        place_id: row.get(3)?,
        started_at: row.get(4)?,
        ended_at: row.get(5)?,
        duration_seconds: row.get(6)?,
        result: row.get(7)?,
        possible_crash: row.get(8)?,
        source: row.get(9)?,
        game_instance_id: row.get(10)?,
    })
}

fn watchlist_from_row(row: &Row<'_>) -> rusqlite::Result<WatchlistEntry> {
    Ok(WatchlistEntry {
        id: row.get(0)?,
        kind: row.get(1)?,
        target_id: row.get(2)?,
        label: row.get(3)?,
        image_url: row.get(4)?,
        created_at: row.get(5)?,
    })
}

fn activity_from_row(row: &Row<'_>) -> rusqlite::Result<Activity> {
    Ok(Activity {
        id: row.get(0)?,
        account_profile_id: row.get(1)?,
        game_id: row.get(2)?,
        kind: row.get(3)?,
        status: row.get(4)?,
        message: row.get(5)?,
        error_code: row.get(6)?,
        created_at: row.get(7)?,
    })
}

fn lock_error<T>(error: std::sync::PoisonError<T>) -> AppError {
    AppError::new("DATABASE_LOCK_FAILED", error.to_string())
}

fn database_error(error: rusqlite::Error) -> AppError {
    AppError::new("DATABASE_OPERATION_FAILED", error.to_string())
}
