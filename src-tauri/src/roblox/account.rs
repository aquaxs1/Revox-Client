//! Detects which Roblox account is signed in on this machine.
//!
//! Revox never reads a cookie or a credential. The only signal it uses is the
//! user ID Roblox itself writes into its own local log files when a game is
//! joined — the same folder the spec already allows reading for crash
//! diagnostics. The result is always presented as a *suggestion* the user
//! confirms, never as a fact.

use std::path::PathBuf;

/// Pulls a Roblox user ID out of one log line.
///
/// Roblox has written this field in several shapes over the years, so all the
/// common separators are accepted. Anything that is not 1–20 digits is ignored.
pub fn user_id_from_log_line(line: &str) -> Option<String> {
    const KEY: &str = "userid";
    let lowered = line.to_lowercase();
    let mut search_from = 0usize;

    while let Some(offset) = lowered[search_from..].find(KEY) {
        let after = search_from + offset + KEY.len();
        search_from = after;

        let digits: String = line[after..]
            .chars()
            // Skip the separators between the key and the value.
            .skip_while(|character| matches!(character, '"' | '\'' | ':' | '=' | ' ' | '\t'))
            .take_while(char::is_ascii_digit)
            .collect();

        if !digits.is_empty() && digits.len() <= 20 && digits != "0" {
            return Some(digits);
        }
    }
    None
}

/// Scans log text newest-line-first and returns the first user ID found.
pub fn user_id_from_log(contents: &str) -> Option<String> {
    contents.lines().rev().find_map(user_id_from_log_line)
}

#[cfg(windows)]
fn log_directory() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|base| PathBuf::from(base).join("Roblox").join("logs"))
}

#[cfg(not(windows))]
fn log_directory() -> Option<PathBuf> {
    None
}

/// How many of the newest log files to inspect. Roblox writes one per launch,
/// so a handful covers the recent sessions without reading a whole folder.
const MAX_LOGS: usize = 6;
/// Only the tail of a log matters, and logs can reach megabytes.
const MAX_BYTES: usize = 512 * 1024;

/// The most recently seen Roblox user ID on this machine, if any.
pub fn detect_user_id() -> Option<String> {
    let directory = log_directory()?;
    let mut entries: Vec<(std::time::SystemTime, PathBuf)> = std::fs::read_dir(directory)
        .ok()?
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if path.extension()?.to_str()? != "log" {
                return None;
            }
            Some((entry.metadata().ok()?.modified().ok()?, path))
        })
        .collect();

    entries.sort_by(|left, right| right.0.cmp(&left.0));

    entries
        .into_iter()
        .take(MAX_LOGS)
        .find_map(|(_, path)| {
            let contents = std::fs::read(&path).ok()?;
            let tail = &contents[contents.len().saturating_sub(MAX_BYTES)..];
            user_id_from_log(&String::from_utf8_lossy(tail))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_json_shape() {
        assert_eq!(
            user_id_from_log_line(r#"{"userId":261,"placeId":1818}"#).as_deref(),
            Some("261")
        );
    }

    #[test]
    fn reads_the_spaced_and_equals_shapes() {
        assert_eq!(
            user_id_from_log_line("[FLog::Output] userId: 1234567").as_deref(),
            Some("1234567")
        );
        assert_eq!(
            user_id_from_log_line("launch userId=88").as_deref(),
            Some("88")
        );
    }

    #[test]
    fn is_case_insensitive_about_the_key() {
        assert_eq!(
            user_id_from_log_line("UserID: 42").as_deref(),
            Some("42")
        );
    }

    #[test]
    fn ignores_lines_without_a_usable_value() {
        assert_eq!(user_id_from_log_line("no identity here"), None);
        assert_eq!(user_id_from_log_line("userId: none"), None);
        assert_eq!(user_id_from_log_line("userId: 0"), None);
        // A value that could not be a Roblox ID is rejected rather than trimmed.
        assert_eq!(user_id_from_log_line(&format!("userId: {}", "9".repeat(21))), None);
    }

    #[test]
    fn keeps_scanning_a_line_that_has_several_candidates() {
        assert_eq!(
            user_id_from_log_line("userId: bogus, userId: 555").as_deref(),
            Some("555")
        );
    }

    #[test]
    fn takes_the_most_recent_line_of_a_log() {
        let log = "userId: 111\nsomething else\nuserId: 222\n";
        assert_eq!(user_id_from_log(log).as_deref(), Some("222"));
    }

    #[test]
    fn an_empty_log_yields_nothing() {
        assert_eq!(user_id_from_log(""), None);
    }
}
