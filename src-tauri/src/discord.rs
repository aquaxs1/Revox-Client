//! Discord Rich Presence.
//!
//! Off by default. The user supplies their own Discord application ID; Revox
//! stores no Discord token and reads nothing from Discord. When Discord is not
//! running, every call fails softly so the launcher keeps working.

use std::sync::Mutex;

use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};

use crate::error::AppError;

/// Revox's own Discord application, used so nobody has to register one.
///
/// A Discord application ID is public by design — it is sent in the clear
/// during the RPC handshake — so shipping it is exactly how every other
/// launcher does this. Fill it in once from the Discord Developer Portal and
/// every install gets Rich Presence from a single toggle.
///
/// While it is empty, Rich Presence stays unavailable and the UI says so
/// instead of failing silently.
pub const BUILT_IN_APPLICATION_ID: &str = "";

/// The ID to connect with: the user's override if they set one, otherwise the
/// built-in application.
pub fn resolve_application_id(user_override: Option<&str>) -> Option<String> {
    user_override
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or(Some(BUILT_IN_APPLICATION_ID).filter(|value| !value.is_empty()))
        .map(str::to_owned)
}

pub fn has_built_in() -> bool {
    !BUILT_IN_APPLICATION_ID.is_empty()
}

/// Discord application IDs are numeric snowflakes.
pub fn valid_application_id(value: &str) -> bool {
    let trimmed = value.trim();
    (17..=20).contains(&trimmed.len()) && trimmed.bytes().all(|byte| byte.is_ascii_digit())
}

#[derive(Default)]
pub struct DiscordPresence {
    inner: Mutex<Option<Connected>>,
}

struct Connected {
    application_id: String,
    client: DiscordIpcClient,
}

fn ipc_error(context: &str, error: impl std::fmt::Display) -> AppError {
    AppError::new("DISCORD_UNAVAILABLE", format!("{context}: {error}"))
}

impl DiscordPresence {
    pub fn new() -> Self {
        Self::default()
    }

    /// Connects, or reconnects when the application ID changed.
    ///
    /// Reconnecting for the same ID is a no-op, so a settings save while a
    /// session is running does not drop the presence.
    pub fn connect(&self, application_id: &str) -> Result<(), AppError> {
        if !valid_application_id(application_id) {
            return Err(AppError::new(
                "INVALID_DISCORD_ID",
                "A Discord application ID is 17 to 20 digits",
            ));
        }

        let mut guard = self
            .inner
            .lock()
            .map_err(|error| ipc_error("discord lock", error))?;

        if guard
            .as_ref()
            .is_some_and(|current| current.application_id == application_id)
        {
            return Ok(());
        }

        if let Some(mut previous) = guard.take() {
            let _ = previous.client.close();
        }

        let mut client = DiscordIpcClient::new(application_id)
            .map_err(|error| ipc_error("discord client", error))?;
        client
            .connect()
            .map_err(|error| ipc_error("discord connect", error))?;

        *guard = Some(Connected {
            application_id: application_id.to_string(),
            client,
        });
        Ok(())
    }

    /// Publishes what the user is playing. `started_at` is a Unix timestamp so
    /// Discord shows an elapsed timer.
    pub fn set_playing(
        &self,
        game: &str,
        profile: Option<&str>,
        started_at: i64,
    ) -> Result<(), AppError> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|error| ipc_error("discord lock", error))?;
        let Some(connected) = guard.as_mut() else {
            return Err(AppError::new(
                "DISCORD_NOT_CONNECTED",
                "Discord Rich Presence is not connected",
            ));
        };

        let timestamps = activity::Timestamps::new().start(started_at);
        let mut current = activity::Activity::new()
            .details(game)
            .timestamps(timestamps);
        if let Some(profile) = profile.filter(|value| !value.trim().is_empty()) {
            current = current.state(profile);
        }

        connected
            .client
            .set_activity(current)
            .map_err(|error| ipc_error("discord activity", error))
    }

    /// Removes the presence but keeps the connection, for the next session.
    pub fn clear(&self) -> Result<(), AppError> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|error| ipc_error("discord lock", error))?;
        let Some(connected) = guard.as_mut() else {
            return Ok(());
        };
        connected
            .client
            .clear_activity()
            .map_err(|error| ipc_error("discord clear", error))
    }

    /// Drops the presence and the connection entirely.
    pub fn disconnect(&self) {
        let Ok(mut guard) = self.inner.lock() else {
            return;
        };
        if let Some(mut connected) = guard.take() {
            let _ = connected.client.clear_activity();
            let _ = connected.client.close();
        }
    }

    pub fn is_connected(&self) -> bool {
        self.inner
            .lock()
            .map(|guard| guard.is_some())
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_a_snowflake_shaped_application_id() {
        assert!(valid_application_id("123456789012345678"));
        assert!(valid_application_id("  123456789012345678  "));
    }

    #[test]
    fn rejects_anything_that_is_not_a_snowflake() {
        assert!(!valid_application_id(""));
        assert!(!valid_application_id("1234"));
        assert!(!valid_application_id("abcdefghijklmnopqr"));
        assert!(!valid_application_id("12345678901234567890123"));
        assert!(!valid_application_id("123456789012345678; rm -rf"));
    }

    #[test]
    fn a_user_override_wins_over_the_built_in_application() {
        assert_eq!(
            resolve_application_id(Some("123456789012345678")).as_deref(),
            Some("123456789012345678")
        );
        // Whitespace-only is not an override.
        assert_eq!(
            resolve_application_id(Some("   ")),
            resolve_application_id(None)
        );
    }

    #[test]
    fn without_an_override_it_falls_back_to_the_built_in_one() {
        // Mirrors whatever the constant currently holds, so this stays true
        // both before and after the ID is filled in.
        assert_eq!(resolve_application_id(None).is_some(), has_built_in());
    }

    #[test]
    fn connecting_with_a_bad_id_reports_the_typed_error() {
        let presence = DiscordPresence::new();

        let error = presence.connect("nope").unwrap_err();

        assert_eq!(error.code, "INVALID_DISCORD_ID");
        assert!(!presence.is_connected());
    }

    #[test]
    fn publishing_without_a_connection_fails_instead_of_panicking() {
        let presence = DiscordPresence::new();

        let error = presence.set_playing("Doors", Some("SebiMain"), 0).unwrap_err();

        assert_eq!(error.code, "DISCORD_NOT_CONNECTED");
        // Clearing an absent presence is a no-op rather than an error.
        assert!(presence.clear().is_ok());
        presence.disconnect();
    }
}
