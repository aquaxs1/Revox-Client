//! Public profile, presence and friends lookups.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::{
    api::{
        age_in_days, clean_keyword, client, get_json, post_json, require_id, thumbnails,
        url_encode, ListResponse,
    },
    contracts::{FriendEntry, PresenceState, RobloxUser, UserPresence, UserStats},
    error::AppError,
};

/// Roblox caps most list endpoints well below this; the limit exists so a
/// friends list of thousands cannot turn into thousands of thumbnail lookups.
const MAX_BATCH: usize = 100;

#[derive(Deserialize)]
struct SearchEntry {
    id: i64,
    name: String,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    #[serde(rename = "hasVerifiedBadge")]
    has_verified_badge: Option<bool>,
}

#[derive(Deserialize)]
struct UserDetail {
    id: i64,
    name: String,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    description: Option<String>,
    created: Option<String>,
    #[serde(rename = "isBanned")]
    is_banned: Option<bool>,
    #[serde(rename = "hasVerifiedBadge")]
    has_verified_badge: Option<bool>,
}

#[derive(Deserialize)]
struct CountResponse {
    count: i64,
}

#[derive(Serialize)]
struct UsernamesRequest<'a> {
    usernames: [&'a str; 1],
    #[serde(rename = "excludeBannedUsers")]
    exclude_banned_users: bool,
}

#[derive(Serialize)]
struct PresenceRequest {
    #[serde(rename = "userIds")]
    user_ids: Vec<i64>,
}

#[derive(Deserialize)]
struct PresenceResponse {
    #[serde(rename = "userPresences")]
    user_presences: Vec<PresenceEntry>,
}

#[derive(Deserialize)]
struct PresenceEntry {
    #[serde(rename = "userId")]
    user_id: i64,
    #[serde(rename = "userPresenceType")]
    user_presence_type: Option<i64>,
    #[serde(rename = "lastLocation")]
    last_location: Option<String>,
    #[serde(rename = "placeId")]
    place_id: Option<i64>,
    #[serde(rename = "rootPlaceId")]
    root_place_id: Option<i64>,
    #[serde(rename = "gameId")]
    game_id: Option<String>,
    #[serde(rename = "universeId")]
    universe_id: Option<i64>,
    #[serde(rename = "lastOnline")]
    last_online: Option<String>,
}

fn user_from_detail(detail: UserDetail, avatar_url: Option<String>) -> RobloxUser {
    let created = detail.created;
    RobloxUser {
        id: detail.id.to_string(),
        display_name: detail.display_name.clone().unwrap_or_else(|| detail.name.clone()),
        name: detail.name,
        description: detail.description.unwrap_or_default(),
        account_age_days: created.as_deref().and_then(age_in_days),
        created,
        has_verified_badge: detail.has_verified_badge.unwrap_or(false),
        is_banned: detail.is_banned.unwrap_or(false),
        avatar_url,
    }
}

fn presence_from_entry(entry: PresenceEntry) -> UserPresence {
    UserPresence {
        user_id: entry.user_id.to_string(),
        state: entry
            .user_presence_type
            .map(PresenceState::from)
            .unwrap_or(PresenceState::Unknown),
        last_location: entry.last_location.filter(|value| !value.trim().is_empty()),
        place_id: entry.place_id.map(|value| value.to_string()),
        root_place_id: entry.root_place_id.map(|value| value.to_string()),
        game_instance_id: entry.game_id.filter(|value| !value.trim().is_empty()),
        universe_id: entry.universe_id.map(|value| value.to_string()),
        last_online: entry.last_online,
    }
}

async fn avatars(
    client: &reqwest::Client,
    ids: &[String],
) -> HashMap<String, String> {
    if ids.is_empty() {
        return HashMap::new();
    }
    let url = format!(
        "https://thumbnails.roblox.com/v1/users/avatar-headshot\
         ?userIds={}&size=150x150&format=Png&isCircular=false",
        ids.join(",")
    );
    // A missing avatar is cosmetic; it must never fail the whole lookup.
    thumbnails(client, &url).await.unwrap_or_default()
}

/// Counts live behind separate endpoints and any one of them can be private.
/// A failure yields `None` for that single number rather than an error.
async fn count_or_none(client: &reqwest::Client, url: &str) -> Option<i64> {
    get_json::<CountResponse>(client, url)
        .await
        .ok()
        .map(|response| response.count)
}

pub async fn search(keyword: &str) -> Result<Vec<RobloxUser>, AppError> {
    let keyword = clean_keyword(keyword)?;
    let client = client()?;
    let found: ListResponse<SearchEntry> = get_json(
        &client,
        &format!(
            "https://users.roblox.com/v1/users/search?keyword={}&limit=25",
            url_encode(&keyword)
        ),
    )
    .await?;

    let ids: Vec<String> = found
        .data
        .iter()
        .take(MAX_BATCH)
        .map(|entry| entry.id.to_string())
        .collect();
    let pictures = avatars(&client, &ids).await;

    Ok(found
        .data
        .into_iter()
        .take(MAX_BATCH)
        .map(|entry| {
            let id = entry.id.to_string();
            RobloxUser {
                display_name: entry.display_name.clone().unwrap_or_else(|| entry.name.clone()),
                name: entry.name,
                description: String::new(),
                created: None,
                account_age_days: None,
                has_verified_badge: entry.has_verified_badge.unwrap_or(false),
                is_banned: false,
                avatar_url: pictures.get(&id).cloned(),
                id,
            }
        })
        .collect())
}

/// Resolves an exact username to a user, for the "link my account" flow.
pub async fn by_username(username: &str) -> Result<RobloxUser, AppError> {
    let username = clean_keyword(username)?;
    let client = client()?;
    let response: ListResponse<SearchEntry> = post_json(
        &client,
        "https://users.roblox.com/v1/usernames/users",
        &UsernamesRequest {
            usernames: [&username],
            exclude_banned_users: false,
        },
    )
    .await?;

    let entry = response.data.into_iter().next().ok_or_else(|| {
        AppError::new("USER_NOT_FOUND", "Roblox does not know this username")
    })?;
    profile(&entry.id.to_string()).await
}

pub async fn profile(user_id: &str) -> Result<RobloxUser, AppError> {
    require_id(user_id)?;
    let client = client()?;
    let detail: UserDetail = get_json(
        &client,
        &format!("https://users.roblox.com/v1/users/{user_id}"),
    )
    .await?;
    let pictures = avatars(&client, &[user_id.to_string()]).await;
    Ok(user_from_detail(detail, pictures.get(user_id).cloned()))
}

pub async fn presence(user_ids: &[String]) -> Result<Vec<UserPresence>, AppError> {
    let mut numeric = Vec::new();
    for id in user_ids.iter().take(MAX_BATCH) {
        require_id(id)?;
        numeric.push(id.parse::<i64>().map_err(|_| {
            AppError::new("INVALID_ROBLOX_ID", "A Roblox ID must fit in 64 bits")
        })?);
    }
    if numeric.is_empty() {
        return Ok(Vec::new());
    }

    let client = client()?;
    let response: PresenceResponse = post_json(
        &client,
        "https://presence.roblox.com/v1/presence/users",
        &PresenceRequest { user_ids: numeric },
    )
    .await?;
    Ok(response.user_presences.into_iter().map(presence_from_entry).collect())
}

pub async fn stats(user_id: &str) -> Result<UserStats, AppError> {
    require_id(user_id)?;
    let client = client()?;

    let detail: UserDetail = get_json(
        &client,
        &format!("https://users.roblox.com/v1/users/{user_id}"),
    )
    .await?;
    let pictures = avatars(&client, &[user_id.to_string()]).await;
    let user = user_from_detail(detail, pictures.get(user_id).cloned());

    let followers = count_or_none(
        &client,
        &format!("https://friends.roblox.com/v1/users/{user_id}/followers/count"),
    )
    .await;
    let following = count_or_none(
        &client,
        &format!("https://friends.roblox.com/v1/users/{user_id}/followings/count"),
    )
    .await;
    let friends = count_or_none(
        &client,
        &format!("https://friends.roblox.com/v1/users/{user_id}/friends/count"),
    )
    .await;
    let groups = get_json::<ListResponse<serde_json::Value>>(
        &client,
        &format!("https://groups.roblox.com/v2/users/{user_id}/groups/roles"),
    )
    .await
    .ok()
    .map(|response| response.data.len() as i64);

    // Presence is the most privacy-restricted call here; losing it must not
    // cost the caller the rest of the profile.
    let presence = presence(&[user_id.to_string()])
        .await
        .ok()
        .and_then(|entries| entries.into_iter().next());

    Ok(UserStats {
        user,
        followers,
        following,
        friends,
        groups,
        presence,
    })
}

pub async fn friends(user_id: &str) -> Result<Vec<FriendEntry>, AppError> {
    require_id(user_id)?;
    let client = client()?;
    let response: ListResponse<UserDetail> = get_json(
        &client,
        &format!("https://friends.roblox.com/v1/users/{user_id}/friends"),
    )
    .await?;

    let ids: Vec<String> = response
        .data
        .iter()
        .take(MAX_BATCH)
        .map(|entry| entry.id.to_string())
        .collect();
    let pictures = avatars(&client, &ids).await;
    let presences: HashMap<String, UserPresence> = presence(&ids)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|entry| (entry.user_id.clone(), entry))
        .collect();

    let mut entries: Vec<FriendEntry> = response
        .data
        .into_iter()
        .take(MAX_BATCH)
        .map(|detail| {
            let id = detail.id.to_string();
            FriendEntry {
                user: user_from_detail(detail, pictures.get(&id).cloned()),
                presence: presences.get(&id).cloned(),
            }
        })
        .collect();

    // In-game friends first, then online, then everyone else: the list exists
    // so the user can join someone, and joinable people belong at the top.
    entries.sort_by_key(|entry| {
        let rank = match entry.presence.as_ref().map(|presence| presence.state) {
            Some(PresenceState::InGame) => 0,
            Some(PresenceState::Online) => 1,
            Some(PresenceState::InStudio) => 2,
            _ => 3,
        };
        (rank, entry.user.name.to_lowercase())
    });
    Ok(entries)
}
