pub mod contracts;
pub mod db;
pub mod error;
pub mod roblox;

use std::sync::Arc;

use contracts::{AppSettings, SettingsInput};
use db::repository::{AppBootstrap, Repository, SqliteRepository};
use error::AppError;
use tauri::Manager;

struct AppState {
    repository: Arc<SqliteRepository>,
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
    let locale = state.repository.save_locale(&input.locale)?;
    Ok(AppSettings { locale })
}

fn valid_place_id(place_id: &str) -> bool {
    !place_id.is_empty()
        && place_id.len() <= 20
        && place_id.bytes().all(|byte| byte.is_ascii_digit())
}

#[tauri::command]
fn launch_roblox(place_id: String) -> Result<String, String> {
    if !valid_place_id(&place_id) {
        return Err("Ungültige Place-ID".to_string());
    }

    let url = format!("roblox://placeId={place_id}");

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(&url)
            .spawn()
            .map_err(|error| format!("Roblox konnte nicht geöffnet werden: {error}"))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        return Err("Der native Start ist in diesem Prototyp nur unter Windows verfügbar.".to_string());
    }

    Ok(url)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .build(),
        )
        .setup(|app| {
            let app_data = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data)?;
            let repository = SqliteRepository::open(app_data.join("rift-companion.sqlite"))
                .map_err(|error| {
                    std::io::Error::other(format!("{}: {}", error.code, error.message))
                })?;
            app.manage(AppState {
                repository: Arc::new(repository),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_bootstrap,
            save_settings,
            launch_roblox
        ])
        .run(tauri::generate_context!())
        .expect("error while running Rift Companion");
}

#[cfg(test)]
mod tests {
    use super::valid_place_id;

    #[test]
    fn accepts_numeric_place_ids() {
        assert!(valid_place_id("920587237"));
    }

    #[test]
    fn rejects_shell_input_and_empty_values() {
        assert!(!valid_place_id(""));
        assert!(!valid_place_id("123 & calc.exe"));
        assert!(!valid_place_id("123abc"));
    }
}
