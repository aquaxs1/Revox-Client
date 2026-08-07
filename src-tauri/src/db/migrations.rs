use rusqlite::Connection;

use crate::error::AppError;

pub fn apply_migrations(connection: &mut Connection) -> Result<(), AppError> {
    connection
        .execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(migration_error)?;

    let transaction = connection.transaction().map_err(migration_error)?;
    transaction
        .execute_batch(include_str!("../../migrations/0001_core.sql"))
        .map_err(migration_error)?;
    transaction.commit().map_err(migration_error)
}

fn migration_error(error: rusqlite::Error) -> AppError {
    AppError::new("DATABASE_MIGRATION_FAILED", error.to_string())
}
