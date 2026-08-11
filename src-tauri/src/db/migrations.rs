use rusqlite::Connection;

use crate::error::AppError;

/// Every migration, in order. Each entry is applied at most once and the
/// applied version is recorded in `schema_migrations`.
const MIGRATIONS: &[(i64, &str)] = &[
    (1, include_str!("../../migrations/0001_core.sql")),
    (2, include_str!("../../migrations/0002_revox.sql")),
    (3, include_str!("../../migrations/0003_explorer.sql")),
];

pub fn apply_migrations(connection: &mut Connection) -> Result<(), AppError> {
    connection
        .execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(migration_error)?;
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
               version INTEGER PRIMARY KEY,
               applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
             );",
        )
        .map_err(migration_error)?;

    for (version, sql) in MIGRATIONS {
        if is_applied(connection, *version)? {
            continue;
        }
        let transaction = connection.transaction().map_err(migration_error)?;
        transaction.execute_batch(sql).map_err(migration_error)?;
        transaction
            .execute(
                "INSERT OR IGNORE INTO schema_migrations (version) VALUES (?1)",
                [version],
            )
            .map_err(migration_error)?;
        transaction.commit().map_err(migration_error)?;
    }

    Ok(())
}

fn is_applied(connection: &Connection, version: i64) -> Result<bool, AppError> {
    connection
        .query_row(
            "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1",
            [version],
            |row| row.get::<_, i64>(0),
        )
        .map(|count| count > 0)
        .map_err(migration_error)
}

fn migration_error(error: rusqlite::Error) -> AppError {
    AppError::new("DATABASE_MIGRATION_FAILED", error.to_string())
}
