use std::collections::BTreeSet;

use rift_companion_lib::db::migrations::apply_migrations;
use rusqlite::{params, Connection};

fn temporary_database() -> (tempfile::TempDir, Connection) {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("rift-test.sqlite");
    let connection = Connection::open(path).unwrap();
    (directory, connection)
}

#[test]
fn migration_creates_the_complete_core_schema_with_foreign_keys() {
    let (_directory, mut connection) = temporary_database();

    apply_migrations(&mut connection).unwrap();

    let tables = connection
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .unwrap()
        .query_map([], |row| row.get::<_, String>(0))
        .unwrap()
        .collect::<Result<BTreeSet<_>, _>>()
        .unwrap();
    let expected = BTreeSet::from([
        "account_games".to_string(),
        "account_profiles".to_string(),
        "activities".to_string(),
        "app_profiles".to_string(),
        "collection_games".to_string(),
        "collections".to_string(),
        "games".to_string(),
        "performance_profiles".to_string(),
        "schema_migrations".to_string(),
        "sessions".to_string(),
        "settings".to_string(),
    ]);

    assert!(expected.is_subset(&tables), "missing tables: {:?}", expected.difference(&tables));
    assert_eq!(
        connection
            .query_row("PRAGMA foreign_keys", [], |row| row.get::<_, i64>(0))
            .unwrap(),
        1
    );
}

#[test]
fn migration_is_idempotent() {
    let (_directory, mut connection) = temporary_database();

    apply_migrations(&mut connection).unwrap();
    apply_migrations(&mut connection).unwrap();

    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| row.get::<_, i64>(0))
            .unwrap(),
        1
    );
}

#[test]
fn duplicate_place_id_is_rejected_within_the_same_app_profile() {
    let (_directory, mut connection) = temporary_database();
    apply_migrations(&mut connection).unwrap();
    connection
        .execute(
            "INSERT INTO games (id, app_profile_id, place_id, name) VALUES (?1, ?2, ?3, ?4)",
            params!["game-1", "default", "123456", "First"],
        )
        .unwrap();

    let duplicate = connection.execute(
        "INSERT INTO games (id, app_profile_id, place_id, name) VALUES (?1, ?2, ?3, ?4)",
        params!["game-2", "default", "123456", "Second"],
    );

    assert!(duplicate.is_err());
}
