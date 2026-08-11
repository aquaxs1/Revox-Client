-- Revox 0.4.0: tray and autostart preferences, friend notifications, Discord
-- Rich Presence, and history for watched profiles, experiences and items.

ALTER TABLE settings ADD COLUMN minimize_to_tray INTEGER NOT NULL DEFAULT 1
  CHECK(minimize_to_tray IN (0, 1));

ALTER TABLE settings ADD COLUMN autostart_enabled INTEGER NOT NULL DEFAULT 0
  CHECK(autostart_enabled IN (0, 1));

ALTER TABLE settings ADD COLUMN notify_friends INTEGER NOT NULL DEFAULT 0
  CHECK(notify_friends IN (0, 1));

-- Discord Rich Presence is off by default and needs an application ID the user
-- supplies. Revox never stores a Discord token.
ALTER TABLE settings ADD COLUMN discord_enabled INTEGER NOT NULL DEFAULT 0
  CHECK(discord_enabled IN (0, 1));

ALTER TABLE settings ADD COLUMN discord_application_id TEXT;

-- One numeric reading of one watched target at one point in time.
--
-- Kept as (metric, value) rows rather than a wide table so a new metric never
-- needs a migration, and so a metric Roblox stopped publishing simply stops
-- producing rows instead of writing zeroes.
CREATE TABLE IF NOT EXISTS watchlist_samples (
  id TEXT PRIMARY KEY,
  watchlist_id TEXT NOT NULL REFERENCES watchlist(id) ON DELETE CASCADE,
  captured_at TEXT NOT NULL,
  metric TEXT NOT NULL,
  value INTEGER NOT NULL,
  UNIQUE(watchlist_id, captured_at, metric)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_samples_target
  ON watchlist_samples(watchlist_id, metric, captured_at);

INSERT OR IGNORE INTO schema_migrations (version) VALUES (4);
