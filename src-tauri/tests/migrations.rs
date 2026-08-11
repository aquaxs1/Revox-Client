use std::collections::BTreeSet;

use revox_client_lib::db::migrations::apply_migrations;
use rusqlite::{params, Connection};

fn temporary_database() -> (tempfile::TempDir, Connection) {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("revox-test.sqlite");
    let connection = Connection::open(path).unwrap();
    (directory, connection)
}

fn table_columns(connection: &Connection, table: &str) -> BTreeSet<String> {
    connection
        .prepare(&format!("PRAGMA table_info({table})"))
        .unwrap()
        .query_map([], |row| row.get::<_, String>(1))
        .unwrap()
        .collect::<Result<BTreeSet<_>, _>>()
        .unwrap()
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

    assert!(
        expected.is_subset(&tables),
        "missing tables: {:?}",
        expected.difference(&tables)
    );
    assert_eq!(
        connection
            .query_row("PRAGMA foreign_keys", [], |row| row.get::<_, i64>(0))
            .unwrap(),
        1
    );
}

#[test]
fn second_migration_adds_the_revox_columns() {
    let (_directory, mut connection) = temporary_database();

    apply_migrations(&mut connection).unwrap();

    let settings = table_columns(&connection, "settings");
    for column in ["sidebar_expanded", "onboarding_complete", "robux_spent"] {
        assert!(settings.contains(column), "settings is missing {column}");
    }
    let games = table_columns(&connection, "games");
    for column in ["universe_id", "playing", "visits", "metadata_synced_at"] {
        assert!(games.contains(column), "games is missing {column}");
    }
}

#[test]
fn sessions_accept_the_revox_source_and_reject_unknown_ones() {
    let (_directory, mut connection) = temporary_database();
    apply_migrations(&mut connection).unwrap();

    let accepted = connection.execute(
        "INSERT INTO sessions (id, app_profile_id, started_at, result, source)
         VALUES (?1, 'default', '2026-08-05T16:00:00Z', 'completed', 'revox')",
        params!["session-1"],
    );
    let rejected = connection.execute(
        "INSERT INTO sessions (id, app_profile_id, started_at, result, source)
         VALUES (?1, 'default', '2026-08-05T16:00:00Z', 'completed', 'rift')",
        params!["session-2"],
    );

    assert!(accepted.is_ok());
    assert!(rejected.is_err());
}

#[test]
fn migration_is_idempotent() {
    let (_directory, mut connection) = temporary_database();

    apply_migrations(&mut connection).unwrap();
    apply_migrations(&mut connection).unwrap();
    apply_migrations(&mut connection).unwrap();

    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| row
                .get::<_, i64>(0))
            .unwrap(),
        4
    );
}

#[test]
fn third_migration_adds_opt_in_tracking_and_the_watchlist() {
    let (_directory, mut connection) = temporary_database();

    apply_migrations(&mut connection).unwrap();

    let settings = table_columns(&connection, "settings");
    for column in ["stats_tracking_enabled", "roblox_user_id", "roblox_username"] {
        assert!(settings.contains(column), "settings is missing {column}");
    }
    assert!(table_columns(&connection, "sessions").contains("game_instance_id"));

    // Tracking must be off until the user turns it on.
    assert_eq!(
        connection
            .query_row(
                "SELECT stats_tracking_enabled FROM settings WHERE app_profile_id = 'default'",
                [],
                |row| row.get::<_, i64>(0)
            )
            .unwrap(),
        0
    );
}

#[test]
fn fourth_migration_adds_companion_settings_and_sample_history() {
    let (_directory, mut connection) = temporary_database();

    apply_migrations(&mut connection).unwrap();

    let settings = table_columns(&connection, "settings");
    for column in [
        "minimize_to_tray",
        "autostart_enabled",
        "notify_friends",
        "discord_enabled",
        "discord_application_id",
    ] {
        assert!(settings.contains(column), "settings is missing {column}");
    }

    // Notifications, Discord and autostart all start switched off.
    for column in ["notify_friends", "discord_enabled", "autostart_enabled"] {
        assert_eq!(
            connection
                .query_row(
                    &format!("SELECT {column} FROM settings WHERE app_profile_id = 'default'"),
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            0,
            "{column} should default to off"
        );
    }

    assert!(table_columns(&connection, "watchlist_samples").contains("metric"));
}

#[test]
fn deleting_a_watchlist_entry_takes_its_samples_with_it() {
    let (_directory, mut connection) = temporary_database();
    apply_migrations(&mut connection).unwrap();
    connection
        .execute(
            "INSERT INTO watchlist (id, app_profile_id, kind, target_id, label)
             VALUES ('w1', 'default', 'user', '261', 'Shedletsky')",
            [],
        )
        .unwrap();
    connection
        .execute(
            "INSERT INTO watchlist_samples (id, watchlist_id, captured_at, metric, value)
             VALUES ('s1', 'w1', '2026-08-11T12:00:00Z', 'followers', 100)",
            [],
        )
        .unwrap();

    connection
        .execute("DELETE FROM watchlist WHERE id = 'w1'", [])
        .unwrap();

    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM watchlist_samples", [], |row| row
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
}

#[test]
fn the_watchlist_rejects_unknown_kinds_and_non_numeric_targets() {
    let (_directory, mut connection) = temporary_database();
    apply_migrations(&mut connection).unwrap();

    let good = connection.execute(
        "INSERT INTO watchlist (id, app_profile_id, kind, target_id, label)
         VALUES ('w1', 'default', 'user', '261', 'Shedletsky')",
        [],
    );
    let bad_kind = connection.execute(
        "INSERT INTO watchlist (id, app_profile_id, kind, target_id, label)
         VALUES ('w2', 'default', 'clan', '261', 'Nope')",
        [],
    );
    let bad_target = connection.execute(
        "INSERT INTO watchlist (id, app_profile_id, kind, target_id, label)
         VALUES ('w3', 'default', 'user', '2 OR 1=1', 'Nope')",
        [],
    );

    assert!(good.is_ok());
    assert!(bad_kind.is_err());
    assert!(bad_target.is_err());
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
