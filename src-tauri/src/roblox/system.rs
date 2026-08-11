//! The real operating-system implementation behind [`RobloxSystem`], plus the
//! hardware snapshot used by the stats screen.
//!
//! Everything here is read-only apart from `open_uri`, which hands a validated
//! `roblox://` URL to the shell. Revox never launches a Roblox executable
//! directly and never writes to the Roblox installation.

use std::path::PathBuf;
use std::sync::Mutex;

use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};

use crate::{
    contracts::SystemSnapshot,
    error::AppError,
    roblox::{is_player_process, ProcessIdentity, RobloxSystem},
};

pub struct HostSystem {
    system: Mutex<System>,
}

impl HostSystem {
    pub fn new() -> Self {
        Self {
            system: Mutex::new(System::new_with_specifics(
                RefreshKind::nothing().with_processes(ProcessRefreshKind::everything()),
            )),
        }
    }

    /// A point-in-time reading of CPU, memory and GPU.
    ///
    /// CPU usage needs two samples separated by at least
    /// `MINIMUM_CPU_UPDATE_INTERVAL`; the caller polls on a slower cadence than
    /// that, so consecutive calls report a real value.
    pub fn snapshot(&self) -> Result<SystemSnapshot, AppError> {
        let mut system = self
            .system
            .lock()
            .map_err(|error| AppError::new("SYSTEM_LOCK_FAILED", error.to_string()))?;
        system.refresh_cpu_usage();
        system.refresh_memory();

        let cpus = system.cpus();
        let cpu_name = cpus
            .first()
            .map(|cpu| cpu.brand().trim().to_string())
            .filter(|brand| !brand.is_empty());

        Ok(SystemSnapshot {
            os_name: System::long_os_version(),
            cpu_name,
            cpu_cores: (!cpus.is_empty()).then(|| cpus.len()),
            cpu_usage_percent: Some(system.global_cpu_usage()),
            memory_total_bytes: Some(system.total_memory()),
            memory_used_bytes: Some(system.used_memory()),
            gpu_name: gpu_name(),
            // No safe cross-machine counter exists without extra privileges, so
            // the UI shows "not available" rather than an invented number.
            gpu_usage_percent: None,
        })
    }
}

impl Default for HostSystem {
    fn default() -> Self {
        Self::new()
    }
}

impl RobloxSystem for HostSystem {
    fn protocol_command(&self) -> Result<Option<String>, AppError> {
        protocol_command()
    }

    fn known_installations(&self) -> Result<Vec<PathBuf>, AppError> {
        Ok(known_installations())
    }

    fn running_processes(&self) -> Result<Vec<ProcessIdentity>, AppError> {
        let mut system = self
            .system
            .lock()
            .map_err(|error| AppError::new("SYSTEM_LOCK_FAILED", error.to_string()))?;
        system.refresh_processes(ProcessesToUpdate::All, true);

        Ok(system
            .processes()
            .iter()
            .filter_map(|(pid, process)| {
                let name = process.name().to_string_lossy().to_string();
                is_player_process(&name).then(|| ProcessIdentity {
                    pid: pid.as_u32(),
                    name,
                    executable: process.exe().map(PathBuf::from),
                })
            })
            .collect())
    }

    fn open_uri(&self, uri: &str) -> Result<(), AppError> {
        open_uri(uri)
    }
}

#[cfg(windows)]
fn protocol_command() -> Result<Option<String>, AppError> {
    use winreg::enums::{HKEY_CLASSES_ROOT, HKEY_CURRENT_USER};
    use winreg::RegKey;

    // Per-user registration wins over the machine-wide one, matching how
    // Windows resolves the handler itself.
    let candidates: [(winreg::HKEY, &str); 2] = [
        (
            HKEY_CURRENT_USER,
            r"Software\Classes\roblox\shell\open\command",
        ),
        (HKEY_CLASSES_ROOT, r"roblox\shell\open\command"),
    ];

    for (root, path) in candidates {
        if let Ok(key) = RegKey::predef(root).open_subkey(path) {
            if let Ok(command) = key.get_value::<String, _>("") {
                if !command.trim().is_empty() {
                    return Ok(Some(command));
                }
            }
        }
    }
    Ok(None)
}

#[cfg(not(windows))]
fn protocol_command() -> Result<Option<String>, AppError> {
    Ok(None)
}

#[cfg(windows)]
fn known_installations() -> Vec<PathBuf> {
    let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") else {
        return Vec::new();
    };
    let versions = PathBuf::from(local_app_data).join("Roblox").join("Versions");
    let Ok(entries) = std::fs::read_dir(&versions) else {
        return Vec::new();
    };

    let mut found: Vec<PathBuf> = entries
        .flatten()
        .map(|entry| entry.path().join("RobloxPlayerBeta.exe"))
        .filter(|path| path.is_file())
        .collect();
    found.sort();
    found
}

#[cfg(not(windows))]
fn known_installations() -> Vec<PathBuf> {
    Vec::new()
}

#[cfg(windows)]
fn gpu_name() -> Option<String> {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    let display_class =
        r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}";
    let key = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(display_class)
        .ok()?;

    key.enum_keys()
        .flatten()
        .filter_map(|name| key.open_subkey(&name).ok())
        .filter_map(|adapter| adapter.get_value::<String, _>("DriverDesc").ok())
        .find(|description| !description.trim().is_empty())
}

#[cfg(not(windows))]
fn gpu_name() -> Option<String> {
    None
}

#[cfg(windows)]
fn open_uri(uri: &str) -> Result<(), AppError> {
    use std::os::windows::process::CommandExt;

    // `explorer.exe <uri>` hands the URL to the registered handler without
    // going through a shell, so no part of `uri` can be read as a command.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    std::process::Command::new("explorer.exe")
        .arg(uri)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|error| AppError::new("LAUNCH_FAILED", error.to_string()))?;
    Ok(())
}

#[cfg(not(windows))]
fn open_uri(_uri: &str) -> Result<(), AppError> {
    Err(AppError::new(
        "UNSUPPORTED_PLATFORM",
        "Starting the official Roblox client is only supported on Windows",
    ))
}
