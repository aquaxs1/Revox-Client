//! Read-only access to the public Roblox web APIs.
//!
//! Everything here is unauthenticated: no cookie, no token, no login. That is a
//! product boundary, not an oversight — Revox never holds Roblox credentials.
//! The practical consequence is that data Roblox only exposes to a signed-in
//! session (a private inventory, a friend's exact server while their privacy
//! setting hides it) comes back empty, and the UI says "not available" instead
//! of guessing.

pub mod catalog;
pub mod games;
pub mod users;

use std::collections::HashMap;
use std::time::Duration;

use serde::{de::DeserializeOwned, Deserialize, Serialize};

use crate::error::AppError;

const TIMEOUT: Duration = Duration::from_secs(12);
const USER_AGENT: &str = concat!("RevoxClient/", env!("CARGO_PKG_VERSION"));

/// Hosts Roblox serves thumbnails from. An image URL that is not on one of
/// these is dropped rather than stored — the window CSP allows exactly this
/// set, so anything else could not render anyway.
pub const IMAGE_HOSTS: &[&str] = &[
    "tr.rbxcdn.com",
    "t0.rbxcdn.com",
    "t1.rbxcdn.com",
    "t2.rbxcdn.com",
    "t3.rbxcdn.com",
    "t4.rbxcdn.com",
    "t5.rbxcdn.com",
    "t6.rbxcdn.com",
    "t7.rbxcdn.com",
];

pub fn acceptable_image_url(url: &str) -> bool {
    let Some(rest) = url.strip_prefix("https://") else {
        return false;
    };
    let host = rest.split('/').next().unwrap_or_default();
    IMAGE_HOSTS.contains(&host)
}

/// Roblox IDs are always positive integers. Validating before interpolating
/// keeps anything user-supplied from reshaping a request URL.
pub fn valid_id(value: &str) -> bool {
    !value.is_empty() && value.len() <= 20 && value.bytes().all(|byte| byte.is_ascii_digit())
}

pub fn require_id(value: &str) -> Result<(), AppError> {
    if valid_id(value) {
        Ok(())
    } else {
        Err(AppError::new(
            "INVALID_ROBLOX_ID",
            "A Roblox ID must contain 1 to 20 digits",
        ))
    }
}

/// Search keywords go into a query string, so they are length-capped and
/// stripped of control characters before use.
pub fn clean_keyword(value: &str) -> Result<String, AppError> {
    let cleaned: String = value
        .trim()
        .chars()
        .filter(|character| !character.is_control())
        .take(64)
        .collect();
    if cleaned.is_empty() {
        return Err(AppError::new(
            "EMPTY_SEARCH",
            "Enter something to search for",
        ));
    }
    Ok(cleaned)
}

pub fn client() -> Result<reqwest::Client, AppError> {
    reqwest::Client::builder()
        .timeout(TIMEOUT)
        .user_agent(USER_AGENT)
        .build()
        .map_err(|error| AppError::new("API_CLIENT_FAILED", error.to_string()))
}

fn status_error(status: reqwest::StatusCode) -> AppError {
    match status {
        reqwest::StatusCode::TOO_MANY_REQUESTS => AppError::new(
            "API_RATE_LIMITED",
            "Roblox is rate limiting this request, please try again shortly",
        ),
        reqwest::StatusCode::NOT_FOUND => {
            AppError::new("API_NOT_FOUND", "Roblox does not know this entry")
        }
        reqwest::StatusCode::FORBIDDEN => AppError::new(
            "API_FORBIDDEN",
            "Roblox only shares this with a signed-in account",
        ),
        other => AppError::new(
            "API_REQUEST_FAILED",
            format!("Roblox answered with status {other}"),
        ),
    }
}

pub async fn get_json<T: DeserializeOwned>(
    client: &reqwest::Client,
    url: &str,
) -> Result<T, AppError> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| AppError::new("API_UNREACHABLE", error.to_string()))?;

    if !response.status().is_success() {
        return Err(status_error(response.status()));
    }
    response
        .json::<T>()
        .await
        .map_err(|error| AppError::new("API_INVALID_RESPONSE", error.to_string()))
}

/// POSTs to Roblox, transparently handling the CSRF handshake.
///
/// Roblox answers an unauthenticated POST with `403` plus an `x-csrf-token`
/// header; the same request replayed with that header succeeds. The retry
/// happens exactly once so a genuine 403 still surfaces as an error.
pub async fn post_json<B: Serialize, T: DeserializeOwned>(
    client: &reqwest::Client,
    url: &str,
    body: &B,
) -> Result<T, AppError> {
    let first = client
        .post(url)
        .json(body)
        .send()
        .await
        .map_err(|error| AppError::new("API_UNREACHABLE", error.to_string()))?;

    let response = if first.status() == reqwest::StatusCode::FORBIDDEN {
        let Some(token) = first
            .headers()
            .get("x-csrf-token")
            .and_then(|value| value.to_str().ok())
            .map(str::to_owned)
        else {
            return Err(status_error(first.status()));
        };
        client
            .post(url)
            .header("x-csrf-token", token)
            .json(body)
            .send()
            .await
            .map_err(|error| AppError::new("API_UNREACHABLE", error.to_string()))?
    } else {
        first
    };

    if !response.status().is_success() {
        return Err(status_error(response.status()));
    }
    response
        .json::<T>()
        .await
        .map_err(|error| AppError::new("API_INVALID_RESPONSE", error.to_string()))
}

#[derive(Deserialize)]
pub struct ListResponse<T> {
    pub data: Vec<T>,
}

#[derive(Deserialize)]
struct ThumbnailEntry {
    #[serde(rename = "targetId")]
    target_id: i64,
    state: Option<String>,
    #[serde(rename = "imageUrl")]
    image_url: Option<String>,
}

/// Resolves thumbnails for a batch of IDs into `{ id -> url }`.
///
/// A thumbnail that is still rendering, missing, or served from an unexpected
/// host is simply absent from the map; callers treat that as "no image" rather
/// than as a failure, because a missing picture must never hide real stats.
pub async fn thumbnails(
    client: &reqwest::Client,
    url: &str,
) -> Result<HashMap<String, String>, AppError> {
    let response: ListResponse<ThumbnailEntry> = get_json(client, url).await?;
    Ok(response
        .data
        .into_iter()
        .filter(|entry| entry.state.as_deref() == Some("Completed"))
        .filter_map(|entry| {
            let image = entry.image_url?;
            acceptable_image_url(&image).then(|| (entry.target_id.to_string(), image))
        })
        .collect())
}

/// Percent-encodes the characters that would otherwise change a query string.
pub fn url_encode(value: &str) -> String {
    value
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (byte as char).to_string()
            }
            b' ' => "%20".to_string(),
            other => format!("%{other:02X}"),
        })
        .collect()
}

/// Roblox timestamps are RFC 3339. Returns whole days since then.
pub fn age_in_days(created: &str) -> Option<i64> {
    let parsed = chrono::DateTime::parse_from_rfc3339(created).ok()?;
    Some(
        chrono::Utc::now()
            .signed_duration_since(parsed.with_timezone(&chrono::Utc))
            .num_days()
            .max(0),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_roblox_cdn_images() {
        assert!(acceptable_image_url("https://tr.rbxcdn.com/abc"));
        assert!(!acceptable_image_url("http://tr.rbxcdn.com/abc"));
        assert!(!acceptable_image_url("https://rbxcdn.com.evil.example/abc"));
        assert!(!acceptable_image_url("javascript:alert(1)"));
    }

    #[test]
    fn ids_must_be_digits_only() {
        assert!(valid_id("1"));
        assert!(valid_id("12345678901234567890"));
        assert!(!valid_id(""));
        assert!(!valid_id("123abc"));
        assert!(!valid_id("1&limit=99"));
        assert!(!valid_id("123456789012345678901"));
    }

    #[test]
    fn keywords_are_trimmed_capped_and_stripped_of_control_characters() {
        assert_eq!(clean_keyword("  doors  ").unwrap(), "doors");
        assert_eq!(clean_keyword("do\nors").unwrap(), "doors");
        assert_eq!(clean_keyword(&"a".repeat(200)).unwrap().len(), 64);
        assert!(clean_keyword("   ").is_err());
    }

    #[test]
    fn encodes_everything_that_could_change_a_query_string() {
        assert_eq!(url_encode("doors"), "doors");
        assert_eq!(url_encode("hello world"), "hello%20world");
        assert_eq!(url_encode("a&limit=99"), "a%26limit%3D99");
        assert_eq!(url_encode("a#b?c"), "a%23b%3Fc");
        assert_eq!(url_encode("ü"), "%C3%BC");
    }

    #[test]
    fn account_age_never_goes_negative() {
        assert!(age_in_days("2006-02-27T00:00:00Z").unwrap() > 7000);
        let tomorrow = (chrono::Utc::now() + chrono::Duration::days(1)).to_rfc3339();
        assert_eq!(age_in_days(&tomorrow), Some(0));
        assert_eq!(age_in_days("not a date"), None);
    }
}
