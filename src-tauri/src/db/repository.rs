use std::sync::Mutex;

use rusqlite::{params, types::Type, Connection, Row};
use serde::{Deserialize, Serialize};

use crate::{
    contracts::AppSettings,
    db::migrations::apply_migrations,
    error::AppError,
};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccountInput {
    pub id: Option<String>,
    pub username: String,
    pub label: String,
    pub initials: String,
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
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub account_profile_id: Option<String>,
    pub game_id: Option<String>,
    pub duration_seconds: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppBootstrap {
    pub settings: AppSettings,
    pub accounts: Vec<AccountProfile>,
    pub games: Vec<Game>,
    pub sessions: Vec<Session>,
    pub performance_profile_ids: Vec<String>,
}

pub trait Repository: Send + Sync {
    fn bootstrap(&self) -> Result<AppBootstrap, AppError>;
    fn save_locale(&self, locale: &str) -> Result<String, AppError>;
    fn upsert_account(&self, input: AccountInput) -> Result<AccountProfile, AppError>;
    fn delete_account(&self, id: &str, keep_stats: bool) -> Result<(), AppError>;
    fn upsert_game(&self, input: GameInput) -> Result<Game, AppError>;
    fn finish_session(&self, input: FinishedSession) -> Result<Session, AppError>;
}

pub struct SqliteRepository {
    connection: Mutex<Connection>,
}

impl SqliteRepository {
    pub fn open(path: impl AsRef<std::path::Path>) -> Result<Self, AppError> {
        let connection = Connection::open(path).map_err(database_error)?;
        Self::from_connection(connection)
    }

    pub fn from_connection(mut connection: Connection) -> Result<Self, AppError> {
        apply_migrations(&mut connection)?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }
}

impl Repository for SqliteRepository {
    fn bootstrap(&self) -> Result<AppBootstrap, AppError> {
        let connection = self.connection.lock().map_err(lock_error)?;
        let locale = connection
            .query_row(
                "SELECT locale FROM settings WHERE app_profile_id = 'default'",
                [],
                |row| row.get(0),
            )
            .map_err(database_error)?;

        let accounts = collect_rows(
            &connection,
            "SELECT id, username, label, initials, color, note, avatar_url
             FROM account_profiles WHERE app_profile_id = 'default' ORDER BY created_at, id",
            account_from_row,
        )?;
        let games = collect_rows(
            &connection,
            "SELECT id, place_id, name, description, image_url, tags_json
             FROM games WHERE app_profile_id = 'default' ORDER BY created_at, id",
            game_from_row,
        )?;
        let sessions = collect_rows(
            &connection,
            "SELECT id, account_profile_id, game_id, duration_seconds
             FROM sessions WHERE app_profile_id = 'default' AND ended_at IS NOT NULL
             ORDER BY started_at, id",
            session_from_row,
        )?;
        let performance_profile_ids = collect_rows(
            &connection,
            "SELECT id FROM performance_profiles ORDER BY id",
            |row| row.get(0),
        )?;

        Ok(AppBootstrap {
            settings: AppSettings { locale },
            accounts,
            games,
            sessions,
            performance_profile_ids,
        })
    }

    fn save_locale(&self, locale: &str) -> Result<String, AppError> {
        if !matches!(locale, "de" | "en") {
            return Err(AppError::new(
                "INVALID_LOCALE",
                "Locale must be de or en",
            ));
        }
        let connection = self.connection.lock().map_err(lock_error)?;
        connection
            .execute(
                "UPDATE settings SET locale = ?1, updated_at = CURRENT_TIMESTAMP
                 WHERE app_profile_id = 'default'",
                [locale],
            )
            .map_err(database_error)?;
        Ok(locale.to_string())
    }

    fn upsert_account(&self, input: AccountInput) -> Result<AccountProfile, AppError> {
        let id = input.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let connection = self.connection.lock().map_err(lock_error)?;
        connection
            .execute(
                "INSERT INTO account_profiles
                   (id, app_profile_id, username, label, initials, color, note, avatar_url)
                 VALUES (?1, 'default', ?2, ?3, ?4, ?5, ?6, ?7)
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
                    input.username,
                    input.label,
                    input.initials,
                    input.color,
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
            return Err(AppError::new("ACCOUNT_NOT_FOUND", "Account profile not found"));
        }
        transaction.commit().map_err(database_error)
    }

    fn upsert_game(&self, input: GameInput) -> Result<Game, AppError> {
        let id = input.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let tags_json = serde_json::to_string(&input.tags)
            .map_err(|error| AppError::new("INVALID_TAGS", error.to_string()))?;
        let connection = self.connection.lock().map_err(lock_error)?;
        connection
            .execute(
                "INSERT INTO games
                   (id, app_profile_id, place_id, name, description, image_url, tags_json)
                 VALUES (?1, 'default', ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET
                   place_id = excluded.place_id,
                   name = excluded.name,
                   description = excluded.description,
                   image_url = excluded.image_url,
                   tags_json = excluded.tags_json,
                   updated_at = CURRENT_TIMESTAMP",
                params![
                    id,
                    input.place_id,
                    input.name,
                    input.description,
                    input.image_url,
                    tags_json
                ],
            )
            .map_err(database_error)?;
        connection
            .query_row(
                "SELECT id, place_id, name, description, image_url, tags_json
                 FROM games WHERE id = ?1",
                [&id],
                game_from_row,
            )
            .map_err(database_error)
    }

    fn finish_session(&self, input: FinishedSession) -> Result<Session, AppError> {
        if input.duration_seconds < 0 {
            return Err(AppError::new(
                "INVALID_SESSION_DURATION",
                "Session duration must not be negative",
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
                    ended_at, duration_seconds, result, possible_crash, source)
                 VALUES (?1, 'default', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    id,
                    input.account_profile_id,
                    input.game_id,
                    input.place_id,
                    input.started_at,
                    input.ended_at,
                    input.duration_seconds,
                    result,
                    input.possible_crash,
                    input.source
                ],
            )
            .map_err(database_error)?;

        if let (Some(account_id), Some(game_id)) =
            (&input.account_profile_id, &input.game_id)
        {
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
            duration_seconds: input.duration_seconds,
        })
    }
}

fn collect_rows<T>(
    connection: &Connection,
    sql: &str,
    map: impl FnMut(&Row<'_>) -> rusqlite::Result<T>,
) -> Result<Vec<T>, AppError> {
    let mut statement = connection.prepare(sql).map_err(database_error)?;
    let rows = statement
        .query_map([], map)
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
    })
}

fn session_from_row(row: &Row<'_>) -> rusqlite::Result<Session> {
    Ok(Session {
        id: row.get(0)?,
        account_profile_id: row.get(1)?,
        game_id: row.get(2)?,
        duration_seconds: row.get(3)?,
    })
}

fn lock_error<T>(error: std::sync::PoisonError<T>) -> AppError {
    AppError::new("DATABASE_LOCK_FAILED", error.to_string())
}

fn database_error(error: rusqlite::Error) -> AppError {
    AppError::new("DATABASE_OPERATION_FAILED", error.to_string())
}
