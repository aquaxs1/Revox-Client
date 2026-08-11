-- Revox 0.3.0: settings the launcher shell needs, plus a place to record
-- Robux the user tells us about. Revox never reads a Roblox account, so the
-- Robux figure is a manual local entry and defaults to "nothing recorded".

ALTER TABLE settings ADD COLUMN sidebar_expanded INTEGER NOT NULL DEFAULT 1
  CHECK(sidebar_expanded IN (0, 1));

ALTER TABLE settings ADD COLUMN onboarding_complete INTEGER NOT NULL DEFAULT 0
  CHECK(onboarding_complete IN (0, 1));

ALTER TABLE settings ADD COLUMN robux_spent INTEGER NOT NULL DEFAULT 0
  CHECK(robux_spent >= 0);

-- Cached public catalog data, so the library still renders names and icons
-- when the machine is offline.
ALTER TABLE games ADD COLUMN universe_id TEXT;
ALTER TABLE games ADD COLUMN playing INTEGER;
ALTER TABLE games ADD COLUMN visits INTEGER;
ALTER TABLE games ADD COLUMN metadata_synced_at TEXT;

-- The session source was named after the old product. SQLite cannot alter a
-- CHECK constraint in place, so the table is rebuilt and existing rows are
-- carried over with the source renamed.
CREATE TABLE sessions_revox (
  id TEXT PRIMARY KEY,
  app_profile_id TEXT NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
  account_profile_id TEXT REFERENCES account_profiles(id) ON DELETE SET NULL,
  game_id TEXT REFERENCES games(id) ON DELETE SET NULL,
  place_id TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER CHECK(duration_seconds IS NULL OR duration_seconds >= 0),
  result TEXT NOT NULL CHECK(result IN ('running', 'completed', 'launchTimedOut', 'possibleCrash')),
  possible_crash INTEGER NOT NULL DEFAULT 0 CHECK(possible_crash IN (0, 1)),
  source TEXT NOT NULL CHECK(source IN ('revox', 'manual')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sessions_revox
  (id, app_profile_id, account_profile_id, game_id, place_id, started_at, ended_at,
   duration_seconds, result, possible_crash, source, created_at)
SELECT id, app_profile_id, account_profile_id, game_id, place_id, started_at, ended_at,
       duration_seconds, result, possible_crash,
       CASE source WHEN 'rift' THEN 'revox' ELSE source END,
       created_at
FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_revox RENAME TO sessions;

CREATE INDEX IF NOT EXISTS idx_sessions_started_at
  ON sessions(app_profile_id, started_at);

CREATE INDEX IF NOT EXISTS idx_activities_created_at
  ON activities(app_profile_id, created_at);

-- The default launcher profile was seeded under the old product name.
UPDATE app_profiles SET name = 'Revox', updated_at = CURRENT_TIMESTAMP
WHERE id = 'default' AND name = 'Rift';

INSERT OR IGNORE INTO schema_migrations (version) VALUES (2);
