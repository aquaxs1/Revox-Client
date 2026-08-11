//! Turns a watched profile, experience or item into numeric samples over time.
//!
//! Extraction is pure and returns only the metrics Roblox actually published:
//! a figure that came back `None` produces no row at all, so a gap in the chart
//! means "not published" rather than "zero".

use chrono::{DateTime, Duration, Utc};

use crate::contracts::{CatalogItem, GameStats, UserStats};

/// How long Revox waits between two samples of the same target.
pub const DEFAULT_SAMPLE_INTERVAL_HOURS: i64 = 6;

/// Metric keys. Kept as plain strings in the database so adding one never needs
/// a migration; this list is the authoritative set the UI knows how to label.
pub mod metric {
    pub const FOLLOWERS: &str = "followers";
    pub const FOLLOWING: &str = "following";
    pub const FRIENDS: &str = "friends";
    pub const GROUPS: &str = "groups";

    pub const PLAYING: &str = "playing";
    pub const VISITS: &str = "visits";
    pub const FAVORITES: &str = "favorites";
    pub const UP_VOTES: &str = "upVotes";
    pub const DOWN_VOTES: &str = "downVotes";

    pub const PRICE: &str = "price";
    pub const LOWEST_PRICE: &str = "lowestPrice";
    pub const RECENT_AVERAGE_PRICE: &str = "recentAveragePrice";
    pub const SALES: &str = "sales";
}

/// Collects the `Some` values into `(metric, value)` pairs.
fn collect(pairs: &[(&str, Option<i64>)]) -> Vec<(String, i64)> {
    pairs
        .iter()
        .filter_map(|(name, value)| value.map(|value| (name.to_string(), value)))
        .collect()
}

pub fn metrics_for_user(stats: &UserStats) -> Vec<(String, i64)> {
    collect(&[
        (metric::FOLLOWERS, stats.followers),
        (metric::FOLLOWING, stats.following),
        (metric::FRIENDS, stats.friends),
        (metric::GROUPS, stats.groups),
    ])
}

pub fn metrics_for_game(stats: &GameStats) -> Vec<(String, i64)> {
    collect(&[
        (metric::PLAYING, stats.playing),
        (metric::VISITS, stats.visits),
        (metric::FAVORITES, stats.favorites),
        (metric::UP_VOTES, stats.up_votes),
        (metric::DOWN_VOTES, stats.down_votes),
    ])
}

pub fn metrics_for_item(item: &CatalogItem) -> Vec<(String, i64)> {
    collect(&[
        (metric::PRICE, item.price),
        (metric::LOWEST_PRICE, item.lowest_price),
        (metric::RECENT_AVERAGE_PRICE, item.recent_average_price),
        (metric::SALES, item.sales),
        (metric::FAVORITES, item.favorite_count),
    ])
}

/// Whether a target is due for another reading.
///
/// A target that has never been sampled is always due. An unparsable timestamp
/// is treated as "never sampled" rather than blocking the target forever.
pub fn due_for_sample(
    last_captured_at: Option<&str>,
    now: DateTime<Utc>,
    interval_hours: i64,
) -> bool {
    let Some(last) = last_captured_at else {
        return true;
    };
    let Ok(parsed) = DateTime::parse_from_rfc3339(last) else {
        return true;
    };
    now.signed_duration_since(parsed.with_timezone(&Utc))
        >= Duration::hours(interval_hours.max(1))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contracts::RobloxUser;

    fn now() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-08-11T12:00:00Z")
            .unwrap()
            .with_timezone(&Utc)
    }

    #[test]
    fn a_metric_roblox_withheld_produces_no_row() {
        let stats = UserStats {
            user: RobloxUser::default(),
            followers: Some(100),
            following: None,
            friends: Some(20),
            groups: None,
            presence: None,
        };

        let metrics = metrics_for_user(&stats);

        assert_eq!(
            metrics,
            [
                ("followers".to_string(), 100),
                ("friends".to_string(), 20)
            ]
        );
    }

    #[test]
    fn a_zero_is_recorded_because_zero_is_a_measurement() {
        let stats = GameStats {
            playing: Some(0),
            visits: None,
            ..Default::default()
        };

        assert_eq!(metrics_for_game(&stats), [("playing".to_string(), 0)]);
    }

    #[test]
    fn item_metrics_cover_price_and_resale() {
        let item = CatalogItem {
            price: Some(500),
            lowest_price: Some(450),
            recent_average_price: Some(700),
            sales: Some(26),
            favorite_count: Some(9000),
            ..Default::default()
        };

        let metrics = metrics_for_item(&item);

        assert_eq!(metrics.len(), 5);
        assert!(metrics.contains(&("recentAveragePrice".to_string(), 700)));
    }

    #[test]
    fn a_target_that_was_never_sampled_is_due() {
        assert!(due_for_sample(None, now(), 6));
    }

    #[test]
    fn a_target_sampled_recently_is_not_due() {
        assert!(!due_for_sample(Some("2026-08-11T09:00:00Z"), now(), 6));
        assert!(due_for_sample(Some("2026-08-11T06:00:00Z"), now(), 6));
        assert!(due_for_sample(Some("2026-08-10T00:00:00Z"), now(), 6));
    }

    #[test]
    fn an_unreadable_timestamp_does_not_block_the_target_forever() {
        assert!(due_for_sample(Some("whenever"), now(), 6));
    }

    #[test]
    fn the_interval_is_never_shorter_than_an_hour() {
        // A zero or negative interval would otherwise mean "sample constantly".
        assert!(!due_for_sample(Some("2026-08-11T11:30:00Z"), now(), 0));
        assert!(due_for_sample(Some("2026-08-11T10:30:00Z"), now(), 0));
    }
}
