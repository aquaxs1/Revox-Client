//! Catalog and UGC item lookups, including limited-item resale figures.

use serde::{Deserialize, Serialize};

use crate::{
    api::{clean_keyword, client, get_json, post_json, require_id, thumbnails, url_encode},
    contracts::CatalogItem,
    error::AppError,
};

const MAX_RESULTS: usize = 30;

#[derive(Deserialize)]
struct SearchResponse {
    data: Vec<SearchEntry>,
}

#[derive(Deserialize, Clone)]
struct SearchEntry {
    id: i64,
    #[serde(rename = "itemType")]
    item_type: Option<String>,
}

#[derive(Serialize)]
struct DetailsRequest {
    items: Vec<DetailsItem>,
}

#[derive(Serialize)]
struct DetailsItem {
    #[serde(rename = "itemType")]
    item_type: String,
    id: i64,
}

#[derive(Deserialize)]
struct DetailsResponse {
    data: Vec<DetailEntry>,
}

#[derive(Deserialize)]
struct DetailEntry {
    id: i64,
    #[serde(rename = "itemType")]
    item_type: Option<String>,
    name: Option<String>,
    description: Option<String>,
    #[serde(rename = "creatorName")]
    creator_name: Option<String>,
    #[serde(rename = "creatorTargetId")]
    creator_target_id: Option<i64>,
    price: Option<i64>,
    #[serde(rename = "lowestPrice")]
    lowest_price: Option<i64>,
    #[serde(rename = "favoriteCount")]
    favorite_count: Option<i64>,
    #[serde(rename = "itemRestrictions")]
    item_restrictions: Option<Vec<String>>,
    #[serde(rename = "unitsAvailableForConsumption")]
    units_available: Option<i64>,
}

/// The economy endpoint carries the fields the catalog one omits: creation
/// date, lifetime sales and the limited-item stock.
#[derive(Deserialize)]
struct EconomyDetail {
    #[serde(rename = "Created")]
    created: Option<String>,
    #[serde(rename = "Sales")]
    sales: Option<i64>,
    #[serde(rename = "IsLimited")]
    is_limited: Option<bool>,
    #[serde(rename = "IsLimitedUnique")]
    is_limited_unique: Option<bool>,
    #[serde(rename = "Remaining")]
    remaining: Option<i64>,
}

#[derive(Deserialize)]
struct ResaleData {
    #[serde(rename = "recentAveragePrice")]
    recent_average_price: Option<i64>,
    #[serde(rename = "originalPrice")]
    original_price: Option<i64>,
    sales: Option<i64>,
    #[serde(rename = "numberRemaining")]
    number_remaining: Option<i64>,
}

async fn images(client: &reqwest::Client, ids: &[String]) -> std::collections::HashMap<String, String> {
    if ids.is_empty() {
        return Default::default();
    }
    let url = format!(
        "https://thumbnails.roblox.com/v1/assets?assetIds={}&size=420x420&format=Png&isCircular=false",
        ids.join(",")
    );
    thumbnails(client, &url).await.unwrap_or_default()
}

fn restrictions_of(entry: &DetailEntry) -> (bool, bool) {
    let restrictions = entry.item_restrictions.clone().unwrap_or_default();
    (
        restrictions.iter().any(|value| value == "Limited"),
        restrictions.iter().any(|value| value == "LimitedUnique"),
    )
}

fn item_from_detail(
    entry: DetailEntry,
    image_url: Option<String>,
) -> CatalogItem {
    let (is_limited, is_limited_unique) = restrictions_of(&entry);
    CatalogItem {
        id: entry.id.to_string(),
        item_type: entry.item_type.unwrap_or_else(|| "Asset".to_string()),
        name: entry.name.unwrap_or_default(),
        description: entry.description.unwrap_or_default(),
        creator_id: entry
            .creator_target_id
            .map(|value| value.to_string())
            .unwrap_or_default(),
        creator_name: entry.creator_name.unwrap_or_default(),
        price: entry.price,
        lowest_price: entry.lowest_price,
        favorite_count: entry.favorite_count,
        is_limited,
        is_limited_unique,
        units_available: entry.units_available,
        created: None,
        image_url,
        recent_average_price: None,
        original_price: None,
        sales: None,
        number_remaining: None,
    }
}

async fn details(
    client: &reqwest::Client,
    entries: &[SearchEntry],
) -> Result<Vec<DetailEntry>, AppError> {
    if entries.is_empty() {
        return Ok(Vec::new());
    }
    let request = DetailsRequest {
        items: entries
            .iter()
            .map(|entry| DetailsItem {
                item_type: entry.item_type.clone().unwrap_or_else(|| "Asset".to_string()),
                id: entry.id,
            })
            .collect(),
    };
    let response: DetailsResponse = post_json(
        client,
        "https://catalog.roblox.com/v1/catalog/items/details",
        &request,
    )
    .await?;
    Ok(response.data)
}

pub async fn search(keyword: &str) -> Result<Vec<CatalogItem>, AppError> {
    let keyword = clean_keyword(keyword)?;
    let client = client()?;
    let found: SearchResponse = get_json(
        &client,
        &format!(
            "https://catalog.roblox.com/v1/search/items\
             ?category=All&keyword={}&limit={MAX_RESULTS}",
            url_encode(&keyword)
        ),
    )
    .await?;

    let entries: Vec<SearchEntry> = found.data.into_iter().take(MAX_RESULTS).collect();
    let detailed = details(&client, &entries).await?;
    let ids: Vec<String> = detailed.iter().map(|entry| entry.id.to_string()).collect();
    let pictures = images(&client, &ids).await;

    Ok(detailed
        .into_iter()
        .map(|entry| {
            let image = pictures.get(&entry.id.to_string()).cloned();
            item_from_detail(entry, image)
        })
        .collect())
}

/// One item with everything Revox can learn about it, including resale data
/// for limited items.
pub async fn item(asset_id: &str) -> Result<CatalogItem, AppError> {
    require_id(asset_id)?;
    let numeric = asset_id.parse::<i64>().map_err(|_| {
        AppError::new("INVALID_ROBLOX_ID", "A Roblox ID must fit in 64 bits")
    })?;
    let client = client()?;

    let detailed = details(
        &client,
        &[SearchEntry {
            id: numeric,
            item_type: Some("Asset".to_string()),
        }],
    )
    .await?;
    let entry = detailed.into_iter().next().ok_or_else(|| {
        AppError::new("ITEM_NOT_FOUND", "Roblox does not know this catalog item")
    })?;

    let pictures = images(&client, &[asset_id.to_string()]).await;
    let mut item = item_from_detail(entry, pictures.get(asset_id).cloned());

    // Both extras are optional: an item that is not limited has no resale data,
    // and the economy endpoint is occasionally restricted.
    if let Ok(economy) = get_json::<EconomyDetail>(
        &client,
        &format!("https://economy.roblox.com/v2/assets/{asset_id}/details"),
    )
    .await
    {
        item.created = economy.created;
        item.sales = economy.sales;
        item.number_remaining = economy.remaining;
        item.is_limited |= economy.is_limited.unwrap_or(false);
        item.is_limited_unique |= economy.is_limited_unique.unwrap_or(false);
    }

    if item.is_limited || item.is_limited_unique {
        if let Ok(resale) = get_json::<ResaleData>(
            &client,
            &format!("https://economy.roblox.com/v1/assets/{asset_id}/resale-data"),
        )
        .await
        {
            item.recent_average_price = resale.recent_average_price;
            item.original_price = resale.original_price;
            item.sales = resale.sales.or(item.sales);
            item.number_remaining = resale.number_remaining.or(item.number_remaining);
        }
    }

    Ok(item)
}
