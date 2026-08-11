pub mod contracts;
pub mod db;
pub mod error;
pub mod metadata;
pub mod roblox;
pub mod session;

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use chrono::Utc;
use contracts::{
    AppSettings, GameMetadata, LaunchReceipt, LaunchRequest, RobloxStatus, SettingsInput,
    SystemSnapshot,
};
use db::repository::{
    AccountGame, AccountInput, AccountProfile, Activity, ActivityInput, AppBootstrap,
    FinishedSession, Game, GameInput, Repository, Session, SqliteRepository,
};
use error::AppError;
use roblox::{detect_roblox, launch_official, system::HostSystem, RobloxSystem};
use session::{PendingLaunch, SessionEvent, SessionMachine};
use tauri::{Emitter, Manager};

/// How often the background monitor asks the OS whether Roblox is running.
const MONITOR_INTERVAL: Duration = Duration::from_secs(3);
/// Event name the UI listens on to refresh itself after a session is written.
const SESSION_EVENT: &str = "revox://session-changed";

struct AppState {
    repository: Arc<SqliteRepository>,
    system: Arc<HostSystem>,
    machine: Arc<Mutex<SessionMachine>>,
    started: Instant,
}

impl AppState {
    /// Milliseconds since app start. A monotonic clock is used on purpose:
    /// playtime must not jump when the system clock is corrected.
    fn now_ms(&self) -> u64 {
        self.started.elapsed().as_millis() as u64
    }
}

fn lock_machine(machine: &Mutex<SessionMachine>) -> Result<std::sync::MutexGuard<'_, SessionMachine>, AppError> {
    machine
        .lock()
        .map_err(|error| AppError::new("SESSION_LOCK_FAILED", error.to_string()))
}

#[tauri::command]
fn get_bootstrap(state: tauri::State<'_, AppState>) -> Result<AppBootstrap, AppError> {
    state.repository.bootstrap()
}

#[tauri::command]
fn save_settings(
    state: tauri::State<'_, AppState>,
    input: SettingsInput,
) -> Result<AppSettings, AppError> {
    state.repository.save_settings(input)
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
async fn fetch_game_metadata(place_id: String) -> Result<GameMetadata, AppError> {
    metadata::fetch_metadata(&place_id).await
}

/// Looks the place up on Roblox and writes the result onto the stored game.
#[tauri::command]
async fn sync_game_metadata(
    state: tauri::State<'_, AppState>,
    game_id: String,
    place_id: String,
) -> Result<Game, AppError> {
    let fetched = metadata::fetch_metadata(&place_id).await?;
    state.repository.update_metadata(&game_id, &fetched)
}

/// Hands a validated place over to the official Roblox client and arms the
/// session monitor so the resulting playtime is recorded.
#[tauri::command]
fn launch_roblox(
    state: tauri::State<'_, AppState>,
    input: LaunchRequest,
) -> Result<LaunchReceipt, AppError> {
    let uri = match launch_official(state.system.as_ref(), &input.place_id) {
        Ok(uri) => uri,
        Err(error) => {
            // A failed launch is still worth recording, so the user can see
            // what happened on the profile screen.
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

    lock_machine(&state.machine)?.arm(
        PendingLaunch {
            place_id: Some(input.place_id.clone()),
            game_id: input.game_id.clone(),
            account_profile_id: input.account_profile_id.clone(),
        },
        state.now_ms(),
    );

    Ok(LaunchReceipt {
        uri,
        activity_id: activity.id,
        accepted_at: Utc::now().to_rfc3339(),
    })
}

/// Drives the session state machine on a fixed cadence and persists whatever
/// it decides. Runs for the lifetime of the app on its own thread.
fn spawn_session_monitor(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(MONITOR_INTERVAL);

        let Some(state) = app.try_state::<AppState>() else {
            continue;
        };
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
                });
            }
        }

        let _ = app.emit(SESSION_EVENT, ());
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
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
                started: Instant::now(),
            });
            spawn_session_monitor(app.handle().clone());
            Ok(())
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
            fetch_game_metadata,
            sync_game_metadata,
            launch_roblox
        ])
        .run(tauri::generate_context!())
        .expect("error while running Revox Client");
}
