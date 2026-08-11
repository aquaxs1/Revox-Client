//! Serializes recorded sessions to CSV and JSON.
//!
//! Export is local: Revox writes the file the user picked and sends nothing
//! anywhere. The serializers are pure so the quoting rules are unit tested
//! rather than discovered by a spreadsheet refusing to open the file.

use serde::{Deserialize, Serialize};

use crate::{
    db::repository::{AccountProfile, Game, Session},
    error::AppError,
};

/// One exported session, with the game and profile already resolved to names.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExportRow {
    pub started_at: String,
    pub ended_at: String,
    pub duration_seconds: i64,
    pub game: String,
    pub place_id: String,
    pub profile: String,
    pub result: String,
    pub possible_crash: bool,
}

pub const CSV_HEADER: &[&str] = &[
    "started_at",
    "ended_at",
    "duration_seconds",
    "game",
    "place_id",
    "profile",
    "result",
    "possible_crash",
];

/// Joins sessions with the games and profiles they reference.
///
/// A session whose game or profile has since been deleted still exports, with
/// an empty name rather than being dropped — the playtime happened.
pub fn build_rows(
    sessions: &[Session],
    games: &[Game],
    accounts: &[AccountProfile],
) -> Vec<ExportRow> {
    sessions
        .iter()
        .map(|session| {
            let game = session
                .game_id
                .as_ref()
                .and_then(|id| games.iter().find(|game| &game.id == id));
            let account = session
                .account_profile_id
                .as_ref()
                .and_then(|id| accounts.iter().find(|account| &account.id == id));

            ExportRow {
                started_at: session.started_at.clone(),
                ended_at: session.ended_at.clone().unwrap_or_default(),
                duration_seconds: session.duration_seconds.unwrap_or(0),
                game: game.map(|game| game.name.clone()).unwrap_or_default(),
                place_id: session
                    .place_id
                    .clone()
                    .or_else(|| game.map(|game| game.place_id.clone()))
                    .unwrap_or_default(),
                profile: account
                    .map(|account| account.username.clone())
                    .unwrap_or_default(),
                result: session.result.clone(),
                possible_crash: session.possible_crash,
            }
        })
        .collect()
}

/// Quotes a CSV field per RFC 4180.
///
/// A field is quoted when it contains a separator, a quote or a line break, and
/// embedded quotes are doubled. A leading `=`, `+`, `-` or `@` is also quoted
/// and prefixed with a single quote so spreadsheets treat it as text instead of
/// executing it as a formula.
fn csv_field(value: &str) -> String {
    let risky_formula = value
        .chars()
        .next()
        .is_some_and(|first| matches!(first, '=' | '+' | '-' | '@'));
    let escaped = value.replace('"', "\"\"");
    let body = if risky_formula {
        format!("'{escaped}")
    } else {
        escaped
    };

    if risky_formula
        || value.contains(',')
        || value.contains('"')
        || value.contains('\n')
        || value.contains('\r')
    {
        format!("\"{body}\"")
    } else {
        body
    }
}

pub fn sessions_to_csv(rows: &[ExportRow]) -> String {
    let mut out = String::new();
    out.push_str(&CSV_HEADER.join(","));
    out.push('\n');

    for row in rows {
        let fields = [
            csv_field(&row.started_at),
            csv_field(&row.ended_at),
            row.duration_seconds.to_string(),
            csv_field(&row.game),
            csv_field(&row.place_id),
            csv_field(&row.profile),
            csv_field(&row.result),
            row.possible_crash.to_string(),
        ];
        out.push_str(&fields.join(","));
        out.push('\n');
    }
    out
}

pub fn sessions_to_json(rows: &[ExportRow]) -> Result<String, AppError> {
    serde_json::to_string_pretty(rows)
        .map_err(|error| AppError::new("EXPORT_FAILED", error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session(overrides: Session) -> Session {
        overrides
    }

    fn base_session() -> Session {
        Session {
            id: "s1".to_string(),
            account_profile_id: Some("a1".to_string()),
            game_id: Some("g1".to_string()),
            place_id: Some("920587237".to_string()),
            started_at: "2026-08-10T12:00:00Z".to_string(),
            ended_at: Some("2026-08-10T13:00:00Z".to_string()),
            duration_seconds: Some(3600),
            result: "completed".to_string(),
            possible_crash: false,
            source: "revox".to_string(),
            game_instance_id: None,
        }
    }

    fn game(name: &str) -> Game {
        Game {
            id: "g1".to_string(),
            place_id: "920587237".to_string(),
            name: name.to_string(),
            description: String::new(),
            image_url: None,
            tags: Vec::new(),
            universe_id: None,
            playing: None,
            visits: None,
            last_launched_at: None,
        }
    }

    fn account() -> AccountProfile {
        AccountProfile {
            id: "a1".to_string(),
            username: "SebiMain".to_string(),
            label: "Main".to_string(),
            initials: "SE".to_string(),
            color: "#2E9BF0".to_string(),
            note: String::new(),
            avatar_url: None,
        }
    }

    #[test]
    fn resolves_game_and_profile_names() {
        let rows = build_rows(&[base_session()], &[game("Doors")], &[account()]);

        assert_eq!(rows[0].game, "Doors");
        assert_eq!(rows[0].profile, "SebiMain");
        assert_eq!(rows[0].duration_seconds, 3600);
    }

    #[test]
    fn keeps_a_session_whose_game_was_deleted() {
        let rows = build_rows(&[base_session()], &[], &[]);

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].game, "");
        // The Place ID survives even without the game record.
        assert_eq!(rows[0].place_id, "920587237");
    }

    #[test]
    fn writes_a_header_and_one_line_per_session() {
        let csv = sessions_to_csv(&build_rows(&[base_session()], &[game("Doors")], &[account()]));
        let lines: Vec<&str> = csv.lines().collect();

        assert_eq!(lines[0], CSV_HEADER.join(","));
        assert_eq!(lines.len(), 2);
        assert!(lines[1].contains("Doors"));
    }

    #[test]
    fn quotes_separators_and_doubles_embedded_quotes() {
        let csv = sessions_to_csv(&build_rows(
            &[base_session()],
            &[game(r#"Doors, the "real" one"#)],
            &[account()],
        ));

        assert!(csv.contains(r#""Doors, the ""real"" one""#));
    }

    #[test]
    fn neutralizes_a_name_that_would_be_read_as_a_formula() {
        let csv = sessions_to_csv(&build_rows(
            &[base_session()],
            &[game("=1+1")],
            &[account()],
        ));

        // Quoted and prefixed, so a spreadsheet renders it as text.
        assert!(csv.contains(r#""'=1+1""#));
    }

    #[test]
    fn keeps_a_newline_inside_a_quoted_field() {
        let csv = sessions_to_csv(&build_rows(
            &[base_session()],
            &[game("Two\nLines")],
            &[account()],
        ));

        assert!(csv.contains("\"Two\nLines\""));
    }

    #[test]
    fn an_empty_history_still_exports_a_header() {
        assert_eq!(sessions_to_csv(&[]), format!("{}\n", CSV_HEADER.join(",")));
    }

    #[test]
    fn json_export_round_trips() {
        let rows = build_rows(&[session(base_session())], &[game("Doors")], &[account()]);

        let json = sessions_to_json(&rows).unwrap();
        let parsed: Vec<ExportRow> = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed, rows);
        assert!(json.contains("\"durationSeconds\": 3600"));
    }
}
