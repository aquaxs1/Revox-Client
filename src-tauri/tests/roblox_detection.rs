use std::{
    path::PathBuf,
    sync::Mutex,
};

use rift_companion_lib::{
    contracts::RobloxState,
    error::AppError,
    roblox::{detect_roblox, launch_official, ProcessIdentity, RobloxSystem},
};

struct FakeSystem {
    protocol: Result<Option<String>, AppError>,
    installations: Result<Vec<PathBuf>, AppError>,
    processes: Result<Vec<ProcessIdentity>, AppError>,
    opened: Mutex<Vec<String>>,
}

impl Default for FakeSystem {
    fn default() -> Self {
        Self {
            protocol: Ok(None),
            installations: Ok(Vec::new()),
            processes: Ok(Vec::new()),
            opened: Mutex::new(Vec::new()),
        }
    }
}

impl RobloxSystem for FakeSystem {
    fn protocol_command(&self) -> Result<Option<String>, AppError> {
        self.protocol.clone()
    }

    fn known_installations(&self) -> Result<Vec<PathBuf>, AppError> {
        self.installations.clone()
    }

    fn running_processes(&self) -> Result<Vec<ProcessIdentity>, AppError> {
        self.processes.clone()
    }

    fn open_uri(&self, uri: &str) -> Result<(), AppError> {
        self.opened.lock().unwrap().push(uri.to_string());
        Ok(())
    }
}

#[test]
fn reports_ready_for_protocol_or_known_installation() {
    let protocol = FakeSystem {
        protocol: Ok(Some("RobloxPlayerBeta.exe %1".to_string())),
        ..Default::default()
    };
    let installation_path = PathBuf::from(r"C:\Users\Test\RobloxPlayerBeta.exe");
    let installation = FakeSystem {
        installations: Ok(vec![installation_path.clone()]),
        ..Default::default()
    };

    assert_eq!(detect_roblox(&protocol).state, RobloxState::Ready);
    let status = detect_roblox(&installation);
    assert_eq!(status.state, RobloxState::Ready);
    assert_eq!(status.installation_path, Some(installation_path.display().to_string()));
}

#[test]
fn running_process_takes_precedence() {
    let system = FakeSystem {
        processes: Ok(vec![ProcessIdentity {
            pid: 42,
            name: "RobloxPlayerBeta.exe".to_string(),
            executable: None,
        }]),
        ..Default::default()
    };

    assert_eq!(detect_roblox(&system).state, RobloxState::Running);
}

#[test]
fn distinguishes_not_found_from_check_failure() {
    assert_eq!(detect_roblox(&FakeSystem::default()).state, RobloxState::NotFound);
    let failed = FakeSystem {
        protocol: Err(AppError::new("REGISTRY_FAILED", "registry unavailable")),
        ..Default::default()
    };
    let status = detect_roblox(&failed);
    assert_eq!(status.state, RobloxState::CheckFailed);
    assert_eq!(status.detail.as_deref(), Some("registry unavailable"));
}

#[test]
fn opens_only_the_exact_official_protocol_uri() {
    let system = FakeSystem::default();

    let uri = launch_official(&system, "123456").unwrap();

    assert_eq!(uri, "roblox://placeId=123456");
    assert_eq!(system.opened.lock().unwrap().as_slice(), [uri]);
}

#[test]
fn rejects_invalid_place_id_before_opening_anything() {
    let system = FakeSystem::default();

    let error = launch_official(&system, "123 & calc.exe").unwrap_err();

    assert_eq!(error.code, "INVALID_PLACE_ID");
    assert!(system.opened.lock().unwrap().is_empty());
}
