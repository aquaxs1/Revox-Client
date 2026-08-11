use revox_client_lib::{
    contracts::{GameMetadata, SettingsInput},
    db::repository::{
        initials_for, normalize_tags, AccountInput, ActivityInput, FinishedSession, GameInput,
        Repository, SqliteRepository, WatchlistInput,
    },
};

fn repository() -> SqliteRepository {
    SqliteRepository::in_memory().unwrap()
}

fn account_input() -> AccountInput {
    AccountInput {
        id: Some("account-1".to_string()),
        username: "SebiMain".to_string(),
        label: "Main".to_string(),
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
        tags: vec!["Obby".to_string(), "friends".to_string()],
    }
}

#[test]
fn a_fresh_install_starts_completely_empty() {
    let repository = repository();

    let bootstrap = repository.bootstrap().unwrap();

    assert_eq!(bootstrap.settings.locale, "de");
    assert!(!bootstrap.settings.onboarding_complete);
    assert_eq!(bootstrap.settings.robux_spent, 0);
    assert!(bootstrap.accounts.is_empty());
    assert!(bootstrap.games.is_empty());
    assert!(bootstrap.sessions.is_empty());
    assert!(bootstrap.activities.is_empty());
}

#[test]
fn settings_patches_only_touch_the_fields_they_carry() {
    let repository = repository();

    repository
        .save_settings(SettingsInput {
            locale: Some("en".to_string()),
            ..Default::default()
        })
        .unwrap();
    let settings = repository
        .save_settings(SettingsInput {
            onboarding_complete: Some(true),
            ..Default::default()
        })
        .unwrap();

    assert_eq!(settings.locale, "en");
    assert!(settings.onboarding_complete);
    assert_eq!(repository.settings().unwrap().locale, "en");
}

#[test]
fn settings_reject_values_outside_the_allowed_set() {
    let repository = repository();

    for input in [
        SettingsInput {
            locale: Some("fr".to_string()),
            ..Default::default()
        },
        SettingsInput {
            theme: Some("neon".to_string()),
            ..Default::default()
        },
        SettingsInput {
            accent: Some("not-a-color".to_string()),
            ..Default::default()
        },
        SettingsInput {
            spacing: Some("tight".to_string()),
            ..Default::default()
        },
        SettingsInput {
            robux_spent: Some(-1),
            ..Default::default()
        },
    ] {
        assert!(repository.save_settings(input).is_err());
    }

    assert_eq!(repository.settings().unwrap().locale, "de");
}

#[test]
fn accounts_derive_initials_and_reject_bad_input() {
    let repository = repository();

    let account = repository.upsert_account(account_input()).unwrap();
    assert_eq!(account.initials, "SE");

    let spaced = repository
        .upsert_account(AccountInput {
            id: Some("account-2".to_string()),
            username: "Alt Konto".to_string(),
            ..account_input()
        })
        .unwrap();
    assert_eq!(spaced.initials, "AK");

    assert!(repository
        .upsert_account(AccountInput {
            id: Some("account-3".to_string()),
            username: "   ".to_string(),
            ..account_input()
        })
        .is_err());
    assert!(repository
        .upsert_account(AccountInput {
            id: Some("account-4".to_string()),
            color: "red".to_string(),
            ..account_input()
        })
        .is_err());
}

#[test]
fn adding_the_same_place_twice_updates_instead_of_failing() {
    let repository = repository();
    repository.upsert_game(game_input()).unwrap();

    let second = repository
        .upsert_game(GameInput {
            id: None,
            name: "Renamed Experience".to_string(),
            ..game_input()
        })
        .unwrap();

    assert_eq!(second.id, "game-1");
    assert_eq!(second.name, "Renamed Experience");
    assert_eq!(repository.bootstrap().unwrap().games.len(), 1);
}

#[test]
fn games_reject_non_numeric_place_ids_and_normalize_tags() {
    let repository = repository();

    let game = repository.upsert_game(game_input()).unwrap();
    assert_eq!(game.tags, ["obby", "friends"]);

    assert!(repository
        .upsert_game(GameInput {
            id: Some("game-2".to_string()),
            place_id: "123 & calc.exe".to_string(),
            ..game_input()
        })
        .is_err());
}

#[test]
fn favorites_are_stored_per_account() {
    let repository = repository();
    let account = repository.upsert_account(account_input()).unwrap();
    let game = repository.upsert_game(game_input()).unwrap();

    let marked = repository
        .set_favorite(&account.id, &game.id, true)
        .unwrap();
    assert!(marked.favorite);

    let cleared = repository
        .set_favorite(&account.id, &game.id, false)
        .unwrap();
    assert!(!cleared.favorite);

    let bootstrap = repository.bootstrap().unwrap();
    assert_eq!(bootstrap.account_games.len(), 1);
}

#[test]
fn metadata_sync_overwrites_the_placeholder_name_and_icon() {
    let repository = repository();
    let game = repository.upsert_game(game_input()).unwrap();

    let updated = repository
        .update_metadata(
            &game.id,
            &GameMetadata {
                place_id: "123456".to_string(),
                universe_id: "987".to_string(),
                name: "Real Roblox Name".to_string(),
                description: "From the Roblox catalog".to_string(),
                icon_url: Some("https://tr.rbxcdn.com/icon".to_string()),
                playing: Some(1200),
                visits: Some(9_000_000),
            },
        )
        .unwrap();

    assert_eq!(updated.name, "Real Roblox Name");
    assert_eq!(updated.universe_id.as_deref(), Some("987"));
    assert_eq!(updated.playing, Some(1200));
}

#[test]
fn a_finished_session_updates_playtime_and_last_launch() {
    let repository = repository();
    let account = repository.upsert_account(account_input()).unwrap();
    let game = repository.upsert_game(game_input()).unwrap();

    repository
        .finish_session(FinishedSession {
            id: Some("session-1".to_string()),
            account_profile_id: Some(account.id.clone()),
            game_id: Some(game.id.clone()),
            place_id: Some(game.place_id.clone()),
            started_at: "2026-08-05T16:00:00Z".to_string(),
            ended_at: "2026-08-05T16:42:00Z".to_string(),
            duration_seconds: 2520,
            possible_crash: false,
            source: "revox".to_string(),
            game_instance_id: None,
        })
        .unwrap();
    let bootstrap = repository.bootstrap().unwrap();

    assert_eq!(bootstrap.sessions.len(), 1);
    assert_eq!(bootstrap.sessions[0].duration_seconds, Some(2520));
    assert_eq!(bootstrap.account_games[0].play_time_seconds, 2520);
    assert!(bootstrap.games[0].last_launched_at.is_some());
}

#[test]
fn sessions_reject_negative_durations_and_unknown_sources() {
    let repository = repository();
    let base = FinishedSession {
        id: None,
        account_profile_id: None,
        game_id: None,
        place_id: None,
        started_at: "2026-08-05T16:00:00Z".to_string(),
        ended_at: "2026-08-05T16:10:00Z".to_string(),
        duration_seconds: 600,
        possible_crash: false,
        source: "revox".to_string(),
        game_instance_id: None,
    };

    assert!(repository
        .finish_session(FinishedSession {
            duration_seconds: -1,
            ..base.clone()
        })
        .is_err());
    assert!(repository
        .finish_session(FinishedSession {
            source: "rift".to_string(),
            ..base.clone()
        })
        .is_err());
    assert!(repository.finish_session(base).is_ok());
}

#[test]
fn activities_are_recorded_and_returned_newest_first() {
    let repository = repository();

    repository
        .record_activity(ActivityInput {
            account_profile_id: None,
            game_id: None,
            kind: "launch".to_string(),
            status: "success".to_string(),
            message: "Handed place 123456 to Roblox".to_string(),
            error_code: None,
        })
        .unwrap();
    assert!(repository
        .record_activity(ActivityInput {
            account_profile_id: None,
            game_id: None,
            kind: "launch".to_string(),
            status: "unknown".to_string(),
            message: "bad status".to_string(),
            error_code: None,
        })
        .is_err());

    let bootstrap = repository.bootstrap().unwrap();
    assert_eq!(bootstrap.activities.len(), 1);
    assert_eq!(bootstrap.activities[0].status, "success");
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
                source: "revox".to_string(),
                game_instance_id: None,
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
    let path = directory.path().join("revox.sqlite");
    {
        let repository = SqliteRepository::open(&path).unwrap();
        repository.upsert_account(account_input()).unwrap();
        repository
            .save_settings(SettingsInput {
                locale: Some("en".to_string()),
                onboarding_complete: Some(true),
                ..Default::default()
            })
            .unwrap();
    }

    let reopened = SqliteRepository::open(&path).unwrap();
    let bootstrap = reopened.bootstrap().unwrap();

    assert_eq!(bootstrap.settings.locale, "en");
    assert!(bootstrap.settings.onboarding_complete);
    assert_eq!(bootstrap.accounts.len(), 1);
    assert_eq!(bootstrap.accounts[0].username, "SebiMain");
}

#[test]
fn tag_normalization_trims_lowercases_and_deduplicates() {
    let tags = normalize_tags(&[
        "  Obby ".to_string(),
        "OBBY".to_string(),
        "".to_string(),
        "Horror".to_string(),
    ]);

    assert_eq!(tags, ["obby", "horror"]);
}

#[test]
fn initials_fall_back_to_the_label_when_the_username_is_blank() {
    assert_eq!(initials_for("", "Zweitkonto"), "ZW");
    assert_eq!(initials_for("Sebi Zupanc", ""), "SZ");
    assert_eq!(initials_for("x", ""), "X");
}

#[test]
fn the_watchlist_deduplicates_and_refreshes_the_label() {
    let repository = repository();

    let first = repository
        .add_to_watchlist(WatchlistInput {
            kind: "user".to_string(),
            target_id: "261".to_string(),
            label: "Shedletsky".to_string(),
            image_url: None,
        })
        .unwrap();
    let again = repository
        .add_to_watchlist(WatchlistInput {
            kind: "user".to_string(),
            target_id: "261".to_string(),
            label: "New label".to_string(),
            image_url: Some("https://tr.rbxcdn.com/x".to_string()),
        })
        .unwrap();

    assert_eq!(again.id, first.id);
    assert_eq!(again.label, "New label");
    assert_eq!(repository.list_watchlist().unwrap().len(), 1);

    repository.remove_from_watchlist(&first.id).unwrap();
    assert!(repository.list_watchlist().unwrap().is_empty());
    assert!(repository.remove_from_watchlist(&first.id).is_err());
}

#[test]
fn the_watchlist_rejects_bad_kinds_and_ids_before_touching_sql() {
    let repository = repository();

    assert!(repository
        .add_to_watchlist(WatchlistInput {
            kind: "clan".to_string(),
            target_id: "261".to_string(),
            label: "x".to_string(),
            image_url: None,
        })
        .is_err());
    assert!(repository
        .add_to_watchlist(WatchlistInput {
            kind: "user".to_string(),
            target_id: "261 OR 1=1".to_string(),
            label: "x".to_string(),
            image_url: None,
        })
        .is_err());
}

#[test]
fn a_linked_roblox_id_must_be_numeric() {
    let repository = repository();

    assert!(repository
        .save_settings(SettingsInput {
            roblox_user_id: Some(Some("261".to_string())),
            ..Default::default()
        })
        .is_ok());
    assert!(repository
        .save_settings(SettingsInput {
            roblox_user_id: Some(Some("not-an-id".to_string())),
            ..Default::default()
        })
        .is_err());
    assert_eq!(
        repository.settings().unwrap().roblox_user_id.as_deref(),
        Some("261")
    );
}
