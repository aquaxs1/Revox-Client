-- Revox 0.4.0: opt-in tracking, a linked public Roblox profile for the friends
-- screen, server-aware rejoin, and a watchlist for the stats viewer.

-- Recording playtime is now something the user turns on deliberately.
-- Existing installs keep tracking off until they opt in.
ALTER TABLE settings ADD COLUMN stats_tracking_enabled INTEGER NOT NULL DEFAULT 0
  CHECK(stats_tracking_enabled IN (0, 1));

-- The public Roblox profile the friends screen reads. Revox never signs in;
-- this is only an ID used against public endpoints.
ALTER TABLE settings ADD COLUMN roblox_user_id TEXT;
ALTER TABLE settings ADD COLUMN roblox_username TEXT;

-- Remembering the server instance lets "join again" return to the same server
-- rather than only the same place.
ALTER TABLE sessions ADD COLUMN game_instance_id TEXT;

-- Profiles, games and UGC items the user follows in the stats viewer.
CREATE TABLE IF NOT EXISTS watchlist (
  id TEXT PRIMARY KEY,
  app_profile_id TEXT NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('user', 'game', 'asset')),
  target_id TEXT NOT NULL CHECK(length(target_id) BETWEEN 1 AND 20
    AND target_id NOT GLOB '*[^0-9]*'),
  label TEXT NOT NULL,
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(app_profile_id, kind, target_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_kind
  ON watchlist(app_profile_id, kind, created_at);

INSERT OR IGNORE INTO schema_migrations (version) VALUES (3);
