use rift_companion_lib::db::repository::{
    AccountInput, FinishedSession, GameInput, Repository, SqliteRepository,
};
use rusqlite::Connection;

fn repository() -> SqliteRepository {
    SqliteRepository::from_connection(Connection::open_in_memory().unwrap()).unwrap()
}

fn account_input() -> AccountInput {
    AccountInput {
        id: Some("account-1".to_string()),
        username: "SebiMain".to_string(),
        label: "Main".to_string(),
        initials: "SM".to_string(),
        color: "#45D6E8".to_string(),
        note: "Primary profile".to_string(),
        avatar_url: None,
    }
}

fn game_input() -> GameInput {
    GameInput {
        id: Some("game-1".to_string()),
        place_id: "123456".to_string(),
        name: "Test Experience".to_string(),
        description: "Local test entry".to_string(),
        image_url: None,
        tags: vec!["obby".to_string(), "friends".to_string()],
    }
}

#[test]
fn bootstrap_contains_only_seed_profiles_and_no_sample_activity() {
    let repository = repository();

    let bootstrap = repository.bootstrap().unwrap();

    assert_eq!(bootstrap.settings.locale, "de");
    assert!(bootstrap.accounts.is_empty());
    assert!(bootstrap.games.is_empty());
    assert!(bootstrap.sessions.is_empty());
    assert_eq!(bootstrap.performance_profile_ids, ["balanced", "performance", "quality"]);
}

#[test]
fn locale_is_persisted_and_invalid_values_are_rejected() {
    let repository = repository();

    assert_eq!(repository.save_locale("en").unwrap(), "en");
    assert_eq!(repository.bootstrap().unwrap().settings.locale, "en");
    assert!(repository.save_locale("fr").is_err());
    assert_eq!(repository.bootstrap().unwrap().settings.locale, "en");
}

#[test]
fn account_game_and_finished_session_round_trip_through_sqlite() {
    let repository = repository();
    let account = repository.upsert_account(account_input()).unwrap();
    let game = repository.upsert_game(game_input()).unwrap();

    let session = repository
        .finish_session(FinishedSession {
            id: Some("session-1".to_string()),
            account_profile_id: Some(account.id.clone()),
            game_id: Some(game.id.clone()),
            place_id: Some(game.place_id.clone()),
            started_at: "2026-08-05T16:00:00Z".to_string(),
            ended_at: "2026-08-05T16:42:00Z".to_string(),
            duration_seconds: 2520,
            possible_crash: false,
            source: "rift".to_string(),
        })
        .unwrap();
    let bootstrap = repository.bootstrap().unwrap();

    assert_eq!(session.duration_seconds, 2520);
    assert_eq!(bootstrap.accounts, [account]);
    assert_eq!(bootstrap.games, [game]);
    assert_eq!(bootstrap.sessions, [session]);
}

#[test]
fn deleting_an_account_can_preserve_or_remove_session_statistics() {
    for (keep_stats, expected_sessions) in [(true, 1usize), (false, 0usize)] {
        let repository = repository();
        let account = repository.upsert_account(account_input()).unwrap();
        let game = repository.upsert_game(game_input()).unwrap();
        repository
            .finish_session(FinishedSession {
                id: Some("session-1".to_string()),
                account_profile_id: Some(account.id.clone()),
                game_id: Some(game.id),
                place_id: Some(game.place_id),
                started_at: "2026-08-05T16:00:00Z".to_string(),
                ended_at: "2026-08-05T16:10:00Z".to_string(),
                duration_seconds: 600,
                possible_crash: false,
                source: "rift".to_string(),
            })
            .unwrap();

        repository.delete_account(&account.id, keep_stats).unwrap();
        let bootstrap = repository.bootstrap().unwrap();

        assert!(bootstrap.accounts.is_empty());
        assert_eq!(bootstrap.sessions.len(), expected_sessions);
        if keep_stats {
            assert_eq!(bootstrap.sessions[0].account_profile_id, None);
        }
    }
}

#[test]
fn file_database_survives_repository_restart() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("rift.sqlite");
    {
        let repository = SqliteRepository::open(&path).unwrap();
        repository.upsert_account(account_input()).unwrap();
        repository.save_locale("en").unwrap();
    }

    let reopened = SqliteRepository::open(&path).unwrap();
    let bootstrap = reopened.bootstrap().unwrap();

    assert_eq!(bootstrap.settings.locale, "en");
    assert_eq!(bootstrap.accounts.len(), 1);
    assert_eq!(bootstrap.accounts[0].username, "SebiMain");
}
