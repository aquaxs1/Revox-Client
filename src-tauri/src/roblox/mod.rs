use std::path::PathBuf;

use crate::{
    contracts::{RobloxState, RobloxStatus},
    error::AppError,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessIdentity {
    pub pid: u32,
    pub name: String,
    pub executable: Option<PathBuf>,
}

pub trait RobloxSystem {
    fn protocol_command(&self) -> Result<Option<String>, AppError>;
    fn known_installations(&self) -> Result<Vec<PathBuf>, AppError>;
    fn running_processes(&self) -> Result<Vec<ProcessIdentity>, AppError>;
    fn open_uri(&self, uri: &str) -> Result<(), AppError>;
}

pub fn detect_roblox(system: &impl RobloxSystem) -> RobloxStatus {
    let processes = match system.running_processes() {
        Ok(processes) => processes,
        Err(error) => return check_failed(error),
    };
    if let Some(process) = processes.first() {
        return RobloxStatus {
            state: RobloxState::Running,
            installation_path: process
                .executable
                .as_ref()
                .map(|path| path.display().to_string()),
            detail: Some(format!("{} is running", process.name)),
        };
    }

    let protocol = match system.protocol_command() {
        Ok(protocol) => protocol,
        Err(error) => return check_failed(error),
    };
    let installations = match system.known_installations() {
        Ok(installations) => installations,
        Err(error) => return check_failed(error),
    };
    let installation_path = installations
        .first()
        .map(|path| path.display().to_string());

    if protocol.is_some() || installation_path.is_some() {
        RobloxStatus {
            state: RobloxState::Ready,
            installation_path,
            detail: None,
        }
    } else {
        RobloxStatus {
            state: RobloxState::NotFound,
            installation_path: None,
            detail: None,
        }
    }
}

pub fn launch_official(
    system: &impl RobloxSystem,
    place_id: &str,
) -> Result<String, AppError> {
    if !valid_place_id(place_id) {
        return Err(AppError::new(
            "INVALID_PLACE_ID",
            "Place ID must contain 1 to 20 ASCII digits",
        ));
    }
    let uri = format!("roblox://placeId={place_id}");
    system.open_uri(&uri)?;
    Ok(uri)
}

pub fn valid_place_id(place_id: &str) -> bool {
    !place_id.is_empty()
        && place_id.len() <= 20
        && place_id.bytes().all(|byte| byte.is_ascii_digit())
}

fn check_failed(error: AppError) -> RobloxStatus {
    RobloxStatus {
        state: RobloxState::CheckFailed,
        installation_path: None,
        detail: Some(error.message),
    }
}
