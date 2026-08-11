//! Reads public Roblox catalog data for a place.
//!
//! Only official Roblox endpoints are contacted, no cookie or credential is
//! ever attached, and the returned icon URL is checked against an allowlist of
//! Roblox CDN hosts before it is stored or rendered.

use std::time::Duration;

use serde::Deserialize;

use crate::{contracts::GameMetadata, error::AppError, roblox::valid_place_id};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
const USER_AGENT: &str = concat!("RevoxClient/", env!("CARGO_PKG_VERSION"));

/// Hosts the Roblox thumbnail service hands back image URLs on.
const IMAGE_HOSTS: &[&str] = &[
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

#[derive(Deserialize)]
struct UniverseResponse {
    #[serde(rename = "universeId")]
    universe_id: Option<i64>,
}

#[derive(Deserialize)]
struct ListResponse<T> {
    data: Vec<T>,
}

#[derive(Deserialize)]
struct GameEntry {
    name: Option<String>,
    description: Option<String>,
    playing: Option<i64>,
    visits: Option<i64>,
}

#[derive(Deserialize)]
struct ThumbnailEntry {
    state: Option<String>,
    #[serde(rename = "imageUrl")]
    image_url: Option<String>,
}

/// Accepts an icon URL only when it is HTTPS on a known Roblox CDN host.
///
/// The CSP allows exactly these hosts for `img-src`, so anything else would be
/// blocked at render time anyway — rejecting it here keeps the junk out of the
/// database too.
pub fn acceptable_image_url(url: &str) -> bool {
    let Some(rest) = url.strip_prefix("https://") else {
        return false;
    };
    let host = rest.split('/').next().unwrap_or_default();
    IMAGE_HOSTS.contains(&host)
}

pub async fn fetch_metadata(place_id: &str) -> Result<GameMetadata, AppError> {
    if !valid_place_id(place_id) {
        return Err(AppError::new(
            "INVALID_PLACE_ID",
            "Place ID must contain 1 to 20 ASCII digits",
        ));
    }

    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .user_agent(USER_AGENT)
        .build()
        .map_err(|error| AppError::new("METADATA_CLIENT_FAILED", error.to_string()))?;

    let universe: UniverseResponse = get_json(
        &client,
        &format!("https://apis.roblox.com/universes/v1/places/{place_id}/universe"),
    )
    .await?;
    let universe_id = universe.universe_id.ok_or_else(|| {
        AppError::new(
            "PLACE_NOT_FOUND",
            "Roblox does not know a place with this ID",
        )
    })?;

    let games: ListResponse<GameEntry> = get_json(
        &client,
        &format!("https://games.roblox.com/v1/games?universeIds={universe_id}"),
    )
    .await?;
    let entry = games.data.into_iter().next().ok_or_else(|| {
        AppError::new(
            "PLACE_NOT_FOUND",
            "Roblox returned no catalog entry for this place",
        )
    })?;

    // A missing or still-rendering thumbnail must not fail the whole lookup:
    // the name and description are the valuable part.
    let icon_url = fetch_icon(&client, universe_id).await.unwrap_or(None);

    Ok(GameMetadata {
        place_id: place_id.to_string(),
        universe_id: universe_id.to_string(),
        name: entry
            .name
            .filter(|name| !name.trim().is_empty())
            .unwrap_or_else(|| format!("Roblox place {place_id}")),
        description: entry.description.unwrap_or_default(),
        icon_url,
        playing: entry.playing,
        visits: entry.visits,
    })
}

async fn fetch_icon(client: &reqwest::Client, universe_id: i64) -> Result<Option<String>, AppError> {
    let thumbnails: ListResponse<ThumbnailEntry> = get_json(
        client,
        &format!(
            "https://thumbnails.roblox.com/v1/games/icons\
             ?universeIds={universe_id}&size=512x512&format=Png&isCircular=false"
        ),
    )
    .await?;

    Ok(thumbnails
        .data
        .into_iter()
        .filter(|entry| entry.state.as_deref() == Some("Completed"))
        .filter_map(|entry| entry.image_url)
        .find(|url| acceptable_image_url(url)))
}

async fn get_json<T: serde::de::DeserializeOwned>(
    client: &reqwest::Client,
    url: &str,
) -> Result<T, AppError> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| AppError::new("METADATA_UNREACHABLE", error.to_string()))?;

    if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err(AppError::new(
            "METADATA_RATE_LIMITED",
            "Roblox is rate limiting this request, please try again shortly",
        ));
    }
    if !response.status().is_success() {
        return Err(AppError::new(
            "METADATA_REQUEST_FAILED",
            format!("Roblox answered with status {}", response.status()),
        ));
    }

    response
        .json::<T>()
        .await
        .map_err(|error| AppError::new("METADATA_INVALID_RESPONSE", error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::acceptable_image_url;

    #[test]
    fn accepts_roblox_cdn_images() {
        assert!(acceptable_image_url("https://tr.rbxcdn.com/abc/512/512/Image/Png"));
        assert!(acceptable_image_url("https://t3.rbxcdn.com/abc"));
    }

    #[test]
    fn rejects_other_hosts_and_plain_http() {
        assert!(!acceptable_image_url("http://tr.rbxcdn.com/abc"));
        assert!(!acceptable_image_url("https://evil.example.com/abc"));
        assert!(!acceptable_image_url("https://rbxcdn.com.evil.example/abc"));
        assert!(!acceptable_image_url("javascript:alert(1)"));
    }
}
