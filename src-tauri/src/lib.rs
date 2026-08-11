pub mod api;
pub mod contracts;
pub mod db;
pub mod discord;
pub mod error;
pub mod export;
pub mod history;
pub mod notifications;
pub mod roblox;
pub mod session;

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use chrono::Utc;
use contracts::{
    AppSettings, CatalogItem, FriendEntry, GameMetadata, GameServer, GameStats, GameSummary,
    LaunchReceipt, LaunchRequest, RobloxStatus, RobloxUser, SettingsInput, SystemSnapshot,
    UserPresence, UserStats,
};
use db::repository::{
    AccountGame, AccountInput, AccountProfile, Activity, ActivityInput, AppBootstrap,
    FinishedSession, Game, GameInput, Repository, Session, SqliteRepository, WatchlistEntry,
    WatchlistInput, WatchlistSample,
};
use discord::DiscordPresence;
use error::AppError;
use notifications::{FriendEvent, PresenceWatcher};
use roblox::{detect_roblox, launch_official, system::HostSystem, RobloxSystem};
use session::{PendingLaunch, SessionEvent, SessionMachine};
use tauri::{Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

/// How often the background monitor asks the OS whether Roblox is running.
const MONITOR_INTERVAL: Duration = Duration::from_secs(3);
/// How often friend presence is polled while notifications are on.
const FRIEND_POLL_INTERVAL: Duration = Duration::from_secs(60);
/// How often the watchlist sampler wakes up; individual targets are still only
/// sampled once per `history::DEFAULT_SAMPLE_INTERVAL_HOURS`.
const SAMPLER_INTERVAL: Duration = Duration::from_secs(15 * 60);

const SESSION_EVENT: &str = "revox://session-changed";
const FRIEND_EVENT: &str = "revox://friend-event";
const WATCHLIST_EVENT: &str = "revox://watchlist-sampled";

struct AppState {
    repository: Arc<SqliteRepository>,
    system: Arc<HostSystem>,
    machine: Arc<Mutex<SessionMachine>>,
    presence: Arc<Mutex<PresenceWatcher>>,
    discord: Arc<DiscordPresence>,
    started: Instant,
}

impl AppState {
    /// Milliseconds since app start. A monotonic clock is used on purpose:
    /// playtime must not jump when the system clock is corrected.
    fn now_ms(&self) -> u64 {
        self.started.elapsed().as_millis() as u64
    }

    fn settings(&self) -> Option<AppSettings> {
        self.repository.settings().ok()
    }
}

fn lock_machine(
    machine: &Mutex<SessionMachine>,
) -> Result<std::sync::MutexGuard<'_, SessionMachine>, AppError> {
    machine
        .lock()
        .map_err(|error| AppError::new("SESSION_LOCK_FAILED", error.to_string()))
}

// ------------------------------------------------------------------- local --

#[tauri::command]
fn get_bootstrap(state: tauri::State<'_, AppState>) -> Result<AppBootstrap, AppError> {
    state.repository.bootstrap()
}

#[tauri::command]
fn save_settings(
    state: tauri::State<'_, AppState>,
    input: SettingsInput,
) -> Result<AppSettings, AppError> {
    let notifications_changed = input.notify_friends.is_some();
    let account_changed = input.roblox_user_id.is_some();
    let settings = state.repository.save_settings(input)?;

    // Relinking or toggling notifications must not compare the new profile's
    // friends against the previous one's readings.
    if notifications_changed || account_changed {
        if let Ok(mut watcher) = state.presence.lock() {
            watcher.reset();
        }
    }
    if !settings.discord_enabled {
        state.discord.disconnect();
    }
    Ok(settings)
}

#[tauri::command]
fn get_roblox_status(state: tauri::State<'_, AppState>) -> Result<RobloxStatus, AppError> {
    Ok(detect_roblox(state.system.as_ref()))
}

#[tauri::command]
fn get_system_snapshot(state: tauri::State<'_, AppState>) -> Result<SystemSnapshot, AppError> {
    state.system.snapshot()
}

#[tauri::command]
fn upsert_account(
    state: tauri::State<'_, AppState>,
    input: AccountInput,
) -> Result<AccountProfile, AppError> {
    state.repository.upsert_account(input)
}

#[tauri::command]
fn delete_account(
    state: tauri::State<'_, AppState>,
    id: String,
    keep_stats: bool,
) -> Result<(), AppError> {
    state.repository.delete_account(&id, keep_stats)
}

#[tauri::command]
fn upsert_game(state: tauri::State<'_, AppState>, input: GameInput) -> Result<Game, AppError> {
    state.repository.upsert_game(input)
}

#[tauri::command]
fn delete_game(state: tauri::State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.repository.delete_game(&id)
}

#[tauri::command]
fn set_favorite(
    state: tauri::State<'_, AppState>,
    account_profile_id: String,
    game_id: String,
    favorite: bool,
) -> Result<AccountGame, AppError> {
    state
        .repository
        .set_favorite(&account_profile_id, &game_id, favorite)
}

#[tauri::command]
fn record_activity(
    state: tauri::State<'_, AppState>,
    input: ActivityInput,
) -> Result<Activity, AppError> {
    state.repository.record_activity(input)
}

#[tauri::command]
fn list_sessions(state: tauri::State<'_, AppState>) -> Result<Vec<Session>, AppError> {
    state.repository.list_sessions()
}

#[tauri::command]
fn add_to_watchlist(
    state: tauri::State<'_, AppState>,
    input: WatchlistInput,
) -> Result<WatchlistEntry, AppError> {
    state.repository.add_to_watchlist(input)
}

#[tauri::command]
fn remove_from_watchlist(state: tauri::State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.repository.remove_from_watchlist(&id)
}

#[tauri::command]
fn list_watchlist(state: tauri::State<'_, AppState>) -> Result<Vec<WatchlistEntry>, AppError> {
    state.repository.list_watchlist()
}

#[tauri::command]
fn list_watchlist_samples(
    state: tauri::State<'_, AppState>,
    watchlist_id: String,
) -> Result<Vec<WatchlistSample>, AppError> {
    state.repository.list_samples(&watchlist_id)
}

// ------------------------------------------------------------------ export --

/// Writes the recorded sessions to a path the user picked in a save dialog.
///
/// The extension must match the format, so a mis-typed name cannot produce a
/// `.csv` file holding JSON.
#[tauri::command]
fn export_sessions(
    state: tauri::State<'_, AppState>,
    format: String,
    path: String,
) -> Result<String, AppError> {
    let bootstrap = state.repository.bootstrap()?;
    let rows = export::build_rows(&bootstrap.sessions, &bootstrap.games, &bootstrap.accounts);

    let lowered = path.to_lowercase();
    let contents = match format.as_str() {
        "csv" if lowered.ends_with(".csv") => export::sessions_to_csv(&rows),
        "json" if lowered.ends_with(".json") => export::sessions_to_json(&rows)?,
        "csv" | "json" => {
            return Err(AppError::new(
                "EXPORT_EXTENSION_MISMATCH",
                "The file name does not match the chosen format",
            ))
        }
        _ => {
            return Err(AppError::new(
                "EXPORT_UNKNOWN_FORMAT",
                "Export format must be csv or json",
            ))
        }
    };

    std::fs::write(&path, contents)
        .map_err(|error| AppError::new("EXPORT_FAILED", error.to_string()))?;
    Ok(path)
}

// ------------------------------------------------------------- roblox data --

#[tauri::command]
async fn fetch_game_metadata(place_id: String) -> Result<GameMetadata, AppError> {
    api::games::metadata(&place_id).await
}

#[tauri::command]
async fn sync_game_metadata(
    state: tauri::State<'_, AppState>,
    game_id: String,
    place_id: String,
) -> Result<Game, AppError> {
    let fetched = api::games::metadata(&place_id).await?;
    state.repository.update_metadata(&game_id, &fetched)
}

#[tauri::command]
async fn search_roblox_users(keyword: String) -> Result<Vec<RobloxUser>, AppError> {
    api::users::search(&keyword).await
}

#[tauri::command]
async fn get_user_stats(user_id: String) -> Result<UserStats, AppError> {
    api::users::stats(&user_id).await
}

#[tauri::command]
async fn get_user_by_username(username: String) -> Result<RobloxUser, AppError> {
    api::users::by_username(&username).await
}

#[tauri::command]
async fn get_friends(user_id: String) -> Result<Vec<FriendEntry>, AppError> {
    api::users::friends(&user_id).await
}

#[tauri::command]
async fn get_presence(user_ids: Vec<String>) -> Result<Vec<UserPresence>, AppError> {
    api::users::presence(&user_ids).await
}

#[tauri::command]
async fn search_roblox_games(keyword: String) -> Result<Vec<GameSummary>, AppError> {
    api::games::search(&keyword).await
}

#[tauri::command]
async fn get_game_stats(universe_id: String) -> Result<GameStats, AppError> {
    api::games::stats(&universe_id).await
}

#[tauri::command]
async fn get_game_stats_for_place(place_id: String) -> Result<GameStats, AppError> {
    api::games::stats_for_place(&place_id).await
}

#[tauri::command]
async fn get_game_servers(place_id: String) -> Result<Vec<GameServer>, AppError> {
    api::games::servers(&place_id).await
}

#[tauri::command]
async fn search_catalog(keyword: String) -> Result<Vec<CatalogItem>, AppError> {
    api::catalog::search(&keyword).await
}

#[tauri::command]
async fn get_catalog_item(asset_id: String) -> Result<CatalogItem, AppError> {
    api::catalog::item(&asset_id).await
}

// ---------------------------------------------------------------- platform --

#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), AppError> {
    use tauri_plugin_autostart::ManagerExt;

    let manager = app.autolaunch();
    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };
    result.map_err(|error| AppError::new("AUTOSTART_FAILED", error.to_string()))
}

/// Checks the configured update endpoint.
///
/// Returns the new version when one exists, `None` when up to date, and a typed
/// error when no release endpoint has been configured for this build.
#[tauri::command]
async fn check_for_update(app: tauri::AppHandle) -> Result<Option<String>, AppError> {
    use tauri_plugin_updater::UpdaterExt;

    let updater = app.updater().map_err(|_| {
        AppError::new(
            "UPDATE_SOURCE_NOT_CONFIGURED",
            "This build has no release endpoint configured",
        )
    })?;
    let update = updater
        .check()
        .await
        .map_err(|error| AppError::new("UPDATE_CHECK_FAILED", error.to_string()))?;
    Ok(update.map(|update| update.version))
}

#[tauri::command]
fn discord_connect(state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let settings = state
        .settings()
        .ok_or_else(|| AppError::new("SETTINGS_UNAVAILABLE", "Could not read settings"))?;
    if !settings.discord_enabled {
        return Err(AppError::new(
            "DISCORD_DISABLED",
            "Discord Rich Presence is switched off",
        ));
    }
    let application_id = settings.discord_application_id.ok_or_else(|| {
        AppError::new("DISCORD_NOT_CONFIGURED", "No Discord application ID set")
    })?;
    state.discord.connect(&application_id)
}

#[tauri::command]
fn discord_clear(state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    state.discord.clear()
}

// ----------------------------------------------------------------- launch --

#[tauri::command]
fn launch_roblox(
    state: tauri::State<'_, AppState>,
    input: LaunchRequest,
) -> Result<LaunchReceipt, AppError> {
    let uri = match launch_official(
        state.system.as_ref(),
        &input.place_id,
        input.game_instance_id.as_deref(),
    ) {
        Ok(uri) => uri,
        Err(error) => {
            let _ = state.repository.record_activity(ActivityInput {
                account_profile_id: input.account_profile_id.clone(),
                game_id: input.game_id.clone(),
                kind: "launch".to_string(),
                status: "error".to_string(),
                message: error.message.clone(),
                error_code: Some(error.code.clone()),
            });
            return Err(error);
        }
    };

    let activity = state.repository.record_activity(ActivityInput {
        account_profile_id: input.account_profile_id.clone(),
        game_id: input.game_id.clone(),
        kind: "launch".to_string(),
        status: "success".to_string(),
        message: format!("Handed place {} to Roblox", input.place_id),
        error_code: None,
    })?;

    let settings = state.settings();

    // With tracking off the monitor is never armed, so no session is written
    // and no process is watched.
    if settings
        .as_ref()
        .is_some_and(|settings| settings.stats_tracking_enabled)
    {
        lock_machine(&state.machine)?.arm(
            PendingLaunch {
                place_id: Some(input.place_id.clone()),
                game_id: input.game_id.clone(),
                account_profile_id: input.account_profile_id.clone(),
                game_instance_id: input.game_instance_id.clone(),
            },
            state.now_ms(),
        );
    }

    // Discord is best effort: a missing or closed Discord must never block a
    // launch.
    if settings
        .as_ref()
        .is_some_and(|settings| settings.discord_enabled)
    {
        publish_discord(&state, input.game_id.as_deref());
    }

    Ok(LaunchReceipt {
        uri,
        activity_id: activity.id,
        accepted_at: Utc::now().to_rfc3339(),
    })
}

fn publish_discord(state: &AppState, game_id: Option<&str>) {
    let Some(settings) = state.settings() else {
        return;
    };
    let Some(application_id) = settings.discord_application_id.as_deref() else {
        return;
    };
    if state.discord.connect(application_id).is_err() {
        return;
    }

    let name = game_id
        .and_then(|id| {
            state
                .repository
                .bootstrap()
                .ok()?
                .games
                .into_iter()
                .find(|game| game.id == id)
        })
        .map(|game| game.name)
        .unwrap_or_else(|| "Roblox".to_string());
    let profile = settings.selected_account_id.and_then(|id| {
        state
            .repository
            .bootstrap()
            .ok()?
            .accounts
            .into_iter()
            .find(|account| account.id == id)
            .map(|account| account.username)
    });

    let _ = state
        .discord
        .set_playing(&name, profile.as_deref(), Utc::now().timestamp());
}

// -------------------------------------------------------------- background --

/// Drives the session state machine and persists whatever it decides.
fn spawn_session_monitor(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(MONITOR_INTERVAL);

        let Some(state) = app.try_state::<AppState>() else {
            continue;
        };

        // Tracking is opt-in. While it is off the monitor does not look at
        // processes at all.
        if !state
            .settings()
            .is_some_and(|settings| settings.stats_tracking_enabled)
        {
            if let Ok(mut machine) = state.machine.lock() {
                machine.reset();
            }
            continue;
        }

        let running = state
            .system
            .running_processes()
            .map(|processes| !processes.is_empty())
            .unwrap_or(false);

        let event = {
            let Ok(mut machine) = state.machine.lock() else {
                continue;
            };
            machine.tick(state.now_ms(), running)
        };

        let Some(event) = event else { continue };
        match event {
            SessionEvent::Started { .. } => {}
            SessionEvent::TimedOut { launch } => {
                let _ = state.repository.record_activity(ActivityInput {
                    account_profile_id: launch.account_profile_id,
                    game_id: launch.game_id,
                    kind: "launch".to_string(),
                    status: "info".to_string(),
                    message: "Roblox did not start within the launch window".to_string(),
                    error_code: Some("LAUNCH_TIMED_OUT".to_string()),
                });
            }
            SessionEvent::Ended {
                launch,
                duration_seconds,
                possible_crash,
            } => {
                let ended_at = Utc::now();
                let started_at = ended_at - chrono::Duration::seconds(duration_seconds);
                let _ = state.repository.finish_session(FinishedSession {
                    id: None,
                    account_profile_id: launch.account_profile_id,
                    game_id: launch.game_id,
                    place_id: launch.place_id,
                    started_at: started_at.to_rfc3339(),
                    ended_at: ended_at.to_rfc3339(),
                    duration_seconds,
                    possible_crash,
                    source: "revox".to_string(),
                    game_instance_id: launch.game_instance_id,
                });
                // The session is over, so the presence goes with it.
                let _ = state.discord.clear();
            }
        }

        let _ = app.emit(SESSION_EVENT, ());
    });
}

/// Polls the linked profile's friends and raises a notification when one comes
/// online or starts a game.
fn spawn_friend_poller(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(FRIEND_POLL_INTERVAL);

        let Some(state) = app.try_state::<AppState>() else {
            continue;
        };
        let Some(settings) = state.settings() else {
            continue;
        };
        if !settings.notify_friends {
            continue;
        }
        let Some(user_id) = settings.roblox_user_id else {
            continue;
        };

        let Ok(friends) = tauri::async_runtime::block_on(api::users::friends(&user_id)) else {
            continue;
        };
        let events = {
            let Ok(mut watcher) = state.presence.lock() else {
                continue;
            };
            watcher.diff(&friends)
        };

        for event in &events {
            let (title, body) = match event {
                FriendEvent::CameOnline { name, .. } => ("Revox".to_string(), format!("{name} is online")),
                FriendEvent::StartedPlaying { name, game, .. } => (
                    "Revox".to_string(),
                    if game.is_empty() {
                        format!("{name} started playing")
                    } else {
                        format!("{name} is playing {game}")
                    },
                ),
            };
            let _ = app.notification().builder().title(title).body(body).show();
        }

        if !events.is_empty() {
            let _ = app.emit(FRIEND_EVENT, events);
        }
    });
}

/// Records a numeric reading for each watched target that is due for one.
fn spawn_watchlist_sampler(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(SAMPLER_INTERVAL);

        let Some(state) = app.try_state::<AppState>() else {
            continue;
        };
        let Ok(entries) = state.repository.list_watchlist() else {
            continue;
        };

        let mut sampled = false;
        for entry in entries {
            let last = state.repository.last_sample_at(&entry.id).ok().flatten();
            if !history::due_for_sample(
                last.as_deref(),
                Utc::now(),
                history::DEFAULT_SAMPLE_INTERVAL_HOURS,
            ) {
                continue;
            }

            let metrics = match entry.kind.as_str() {
                "user" => tauri::async_runtime::block_on(api::users::stats(&entry.target_id))
                    .ok()
                    .map(|stats| history::metrics_for_user(&stats)),
                "game" => tauri::async_runtime::block_on(api::games::stats(&entry.target_id))
                    .ok()
                    .map(|stats| history::metrics_for_game(&stats)),
                "asset" => tauri::async_runtime::block_on(api::catalog::item(&entry.target_id))
                    .ok()
                    .map(|item| history::metrics_for_item(&item)),
                _ => None,
            };

            if let Some(metrics) = metrics {
                if state
                    .repository
                    .record_samples(&entry.id, &Utc::now().to_rfc3339(), &metrics)
                    .is_ok()
                {
                    sampled = true;
                }
            }
        }

        if sampled {
            let _ = app.emit(WATCHLIST_EVENT, ());
        }
    });
}

/// Builds the tray icon and its menu.
fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let show = MenuItem::with_id(app, "show", "Revox", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Beenden / Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::with_id("revox-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Revox Client")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => reveal_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                reveal_main_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

fn reveal_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let app_data = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data)?;
            let repository = SqliteRepository::open(app_data.join("revox-client.sqlite"))
                .map_err(|error| {
                    std::io::Error::other(format!("{}: {}", error.code, error.message))
                })?;
            app.manage(AppState {
                repository: Arc::new(repository),
                system: Arc::new(HostSystem::new()),
                machine: Arc::new(Mutex::new(SessionMachine::new())),
                presence: Arc::new(Mutex::new(PresenceWatcher::new())),
                discord: Arc::new(DiscordPresence::new()),
                started: Instant::now(),
            });

            build_tray(app)?;
            spawn_session_monitor(app.handle().clone());
            spawn_friend_poller(app.handle().clone());
            spawn_watchlist_sampler(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing hides to the tray unless the user turned that off, so a
            // stray click on X does not stop playtime recording.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let hide = window
                    .app_handle()
                    .try_state::<AppState>()
                    .and_then(|state| state.settings())
                    .is_some_and(|settings| settings.minimize_to_tray);
                if hide {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_bootstrap,
            save_settings,
            get_roblox_status,
            get_system_snapshot,
            upsert_account,
            delete_account,
            upsert_game,
            delete_game,
            set_favorite,
            record_activity,
            list_sessions,
            add_to_watchlist,
            remove_from_watchlist,
            list_watchlist,
            list_watchlist_samples,
            export_sessions,
            fetch_game_metadata,
            sync_game_metadata,
            search_roblox_users,
            get_user_stats,
            get_user_by_username,
            get_friends,
            get_presence,
            search_roblox_games,
            get_game_stats,
            get_game_stats_for_place,
            get_game_servers,
            search_catalog,
            get_catalog_item,
            set_autostart,
            check_for_update,
            discord_connect,
            discord_clear,
            launch_roblox
        ])
        .run(tauri::generate_context!())
        .expect("error while running Revox Client");
}
