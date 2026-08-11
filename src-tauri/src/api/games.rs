//! Experience lookups: catalog details, votes, live servers and search.

use serde::Deserialize;

use crate::{
    api::{clean_keyword, client, get_json, require_id, thumbnails, url_encode, ListResponse},
    contracts::{GameMetadata, GameServer, GameStats, GameSummary},
    error::AppError,
    roblox::valid_place_id,
};

#[derive(Deserialize)]
struct UniverseResponse {
    #[serde(rename = "universeId")]
    universe_id: Option<i64>,
}

#[derive(Deserialize)]
struct Creator {
    id: Option<i64>,
    name: Option<String>,
    #[serde(rename = "type")]
    kind: Option<String>,
}

#[derive(Deserialize)]
struct GameEntry {
    id: Option<i64>,
    #[serde(rename = "rootPlaceId")]
    root_place_id: Option<i64>,
    name: Option<String>,
    description: Option<String>,
    creator: Option<Creator>,
    playing: Option<i64>,
    visits: Option<i64>,
    #[serde(rename = "maxPlayers")]
    max_players: Option<i64>,
    created: Option<String>,
    updated: Option<String>,
    genre: Option<String>,
    price: Option<i64>,
    #[serde(rename = "favoritedCount")]
    favorited_count: Option<i64>,
}

#[derive(Deserialize)]
struct VotesEntry {
    #[serde(rename = "upVotes")]
    up_votes: Option<i64>,
    #[serde(rename = "downVotes")]
    down_votes: Option<i64>,
}

#[derive(Deserialize)]
struct ServerEntry {
    id: Option<String>,
    playing: Option<i64>,
    #[serde(rename = "maxPlayers")]
    max_players: Option<i64>,
    fps: Option<f64>,
    ping: Option<i64>,
}

#[derive(Deserialize)]
struct SearchResponse {
    games: Vec<SearchEntry>,
}

#[derive(Deserialize)]
struct SearchEntry {
    #[serde(rename = "universeId")]
    universe_id: Option<i64>,
    #[serde(rename = "placeId")]
    place_id: Option<i64>,
    name: Option<String>,
    #[serde(rename = "creatorName")]
    creator_name: Option<String>,
    #[serde(rename = "playerCount")]
    player_count: Option<i64>,
    #[serde(rename = "totalUpVotes")]
    total_up_votes: Option<i64>,
    #[serde(rename = "totalDownVotes")]
    total_down_votes: Option<i64>,
}

pub async fn universe_for_place(
    client: &reqwest::Client,
    place_id: &str,
) -> Result<String, AppError> {
    if !valid_place_id(place_id) {
        return Err(AppError::new(
            "INVALID_PLACE_ID",
            "Place ID must contain 1 to 20 ASCII digits",
        ));
    }
    let response: UniverseResponse = get_json(
        client,
        &format!("https://apis.roblox.com/universes/v1/places/{place_id}/universe"),
    )
    .await?;
    response
        .universe_id
        .map(|value| value.to_string())
        .ok_or_else(|| {
            AppError::new(
                "PLACE_NOT_FOUND",
                "Roblox does not know a place with this ID",
            )
        })
}

async fn icon(client: &reqwest::Client, universe_id: &str) -> Option<String> {
    let url = format!(
        "https://thumbnails.roblox.com/v1/games/icons\
         ?universeIds={universe_id}&size=512x512&format=Png&isCircular=false"
    );
    thumbnails(client, &url)
        .await
        .ok()
        .and_then(|map| map.get(universe_id).cloned())
}

/// The compact shape the library stores for a place.
pub async fn metadata(place_id: &str) -> Result<GameMetadata, AppError> {
    let client = client()?;
    let universe_id = universe_for_place(&client, place_id).await?;
    let entry = entry_for_universe(&client, &universe_id).await?;

    Ok(GameMetadata {
        place_id: place_id.to_string(),
        name: entry
            .name
            .clone()
            .filter(|name| !name.trim().is_empty())
            .unwrap_or_else(|| format!("Roblox place {place_id}")),
        description: entry.description.clone().unwrap_or_default(),
        icon_url: icon(&client, &universe_id).await,
        playing: entry.playing,
        visits: entry.visits,
        universe_id,
    })
}

async fn entry_for_universe(
    client: &reqwest::Client,
    universe_id: &str,
) -> Result<GameEntry, AppError> {
    let games: ListResponse<GameEntry> = get_json(
        client,
        &format!("https://games.roblox.com/v1/games?universeIds={universe_id}"),
    )
    .await?;
    games.data.into_iter().next().ok_or_else(|| {
        AppError::new(
            "PLACE_NOT_FOUND",
            "Roblox returned no catalog entry for this experience",
        )
    })
}

/// The full statistics view, including votes and favourites.
pub async fn stats(universe_id: &str) -> Result<GameStats, AppError> {
    require_id(universe_id)?;
    let client = client()?;
    let entry = entry_for_universe(&client, universe_id).await?;

    // Votes sit behind their own endpoint and are not always published.
    let votes = get_json::<ListResponse<VotesEntry>>(
        &client,
        &format!("https://games.roblox.com/v1/games/votes?universeIds={universe_id}"),
    )
    .await
    .ok()
    .and_then(|response| response.data.into_iter().next());

    let creator = entry.creator.unwrap_or(Creator {
        id: None,
        name: None,
        kind: None,
    });

    Ok(GameStats {
        universe_id: entry
            .id
            .map(|value| value.to_string())
            .unwrap_or_else(|| universe_id.to_string()),
        root_place_id: entry
            .root_place_id
            .map(|value| value.to_string())
            .unwrap_or_default(),
        name: entry.name.unwrap_or_default(),
        description: entry.description.unwrap_or_default(),
        creator_id: creator.id.map(|value| value.to_string()).unwrap_or_default(),
        creator_name: creator.name.unwrap_or_default(),
        creator_type: creator.kind.unwrap_or_default(),
        playing: entry.playing,
        visits: entry.visits,
        favorites: entry.favorited_count,
        up_votes: votes.as_ref().and_then(|entry| entry.up_votes),
        down_votes: votes.as_ref().and_then(|entry| entry.down_votes),
        max_players: entry.max_players,
        created: entry.created,
        updated: entry.updated,
        genre: entry.genre,
        price: entry.price,
        icon_url: icon(&client, universe_id).await,
    })
}

pub async fn stats_for_place(place_id: &str) -> Result<GameStats, AppError> {
    let client = client()?;
    let universe_id = universe_for_place(&client, place_id).await?;
    stats(&universe_id).await
}

/// Live public servers, biggest first.
pub async fn servers(place_id: &str) -> Result<Vec<GameServer>, AppError> {
    if !valid_place_id(place_id) {
        return Err(AppError::new(
            "INVALID_PLACE_ID",
            "Place ID must contain 1 to 20 ASCII digits",
        ));
    }
    let client = client()?;
    let response: ListResponse<ServerEntry> = get_json(
        &client,
        &format!(
            "https://games.roblox.com/v1/games/{place_id}/servers/Public\
             ?sortOrder=Desc&excludeFullGames=false&limit=100"
        ),
    )
    .await?;

    let mut servers: Vec<GameServer> = response
        .data
        .into_iter()
        .filter_map(|entry| {
            Some(GameServer {
                id: entry.id?,
                playing: entry.playing.unwrap_or(0),
                max_players: entry.max_players.unwrap_or(0),
                fps: entry.fps,
                ping: entry.ping,
            })
        })
        .collect();
    servers.sort_by(|left, right| right.playing.cmp(&left.playing));
    Ok(servers)
}

/// Keyword search over experiences.
///
/// This endpoint is the one Roblox uses for its own search box and is the least
/// stable of the ones Revox touches. Failures return a typed error so the UI can
/// point the user at the Place-ID path, which never depends on it.
pub async fn search(keyword: &str) -> Result<Vec<GameSummary>, AppError> {
    let keyword = clean_keyword(keyword)?;
    let client = client()?;
    let response: SearchResponse = get_json(
        &client,
        &format!(
            "https://games.roblox.com/v1/games/list\
             ?model.keyword={}&model.maxRows=25&model.startRows=0",
            url_encode(&keyword)
        ),
    )
    .await
    .map_err(|error| {
        if error.code == "API_INVALID_RESPONSE" {
            AppError::new(
                "GAME_SEARCH_UNAVAILABLE",
                "Roblox game search is not answering right now",
            )
        } else {
            error
        }
    })?;

    let universe_ids: Vec<String> = response
        .games
        .iter()
        .filter_map(|entry| entry.universe_id.map(|value| value.to_string()))
        .collect();
    let icons = if universe_ids.is_empty() {
        Default::default()
    } else {
        thumbnails(
            &client,
            &format!(
                "https://thumbnails.roblox.com/v1/games/icons\
                 ?universeIds={}&size=256x256&format=Png&isCircular=false",
                universe_ids.join(",")
            ),
        )
        .await
        .unwrap_or_default()
    };

    Ok(response
        .games
        .into_iter()
        .filter_map(|entry| {
            let universe_id = entry.universe_id?.to_string();
            Some(GameSummary {
                root_place_id: entry
                    .place_id
                    .map(|value| value.to_string())
                    .unwrap_or_default(),
                name: entry.name.unwrap_or_default(),
                creator_name: entry.creator_name.unwrap_or_default(),
                playing: entry.player_count,
                up_votes: entry.total_up_votes,
                down_votes: entry.total_down_votes,
                icon_url: icons.get(&universe_id).cloned(),
                universe_id,
            })
        })
        .collect())
}
