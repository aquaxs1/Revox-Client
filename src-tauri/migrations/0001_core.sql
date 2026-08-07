CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS account_profiles (
  id TEXT PRIMARY KEY,
  app_profile_id TEXT NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  label TEXT NOT NULL,
  initials TEXT NOT NULL,
  color TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(app_profile_id, username)
);

CREATE TABLE IF NOT EXISTS performance_profiles (
  id TEXT PRIMARY KEY,
  app_profile_id TEXT REFERENCES app_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  profile_kind TEXT NOT NULL CHECK(profile_kind IN ('performance', 'balanced', 'quality', 'custom')),
  target_fps INTEGER,
  graphics_level INTEGER NOT NULL CHECK(graphics_level BETWEEN 1 AND 10),
  overlay_enabled INTEGER NOT NULL DEFAULT 0 CHECK(overlay_enabled IN (0, 1)),
  sample_interval_ms INTEGER NOT NULL DEFAULT 2000 CHECK(sample_interval_ms IN (1000, 2000, 5000)),
  managed_program_policy TEXT NOT NULL DEFAULT 'none' CHECK(managed_program_policy IN ('none', 'ask')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  app_profile_id TEXT NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL CHECK(length(place_id) BETWEEN 1 AND 20 AND place_id NOT GLOB '*[^0-9]*'),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  last_launched_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(app_profile_id, place_id)
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  app_profile_id TEXT NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
  account_profile_id TEXT REFERENCES account_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(app_profile_id, account_profile_id, name)
);

CREATE TABLE IF NOT EXISTS collection_games (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(collection_id, game_id)
);

CREATE TABLE IF NOT EXISTS account_games (
  account_profile_id TEXT NOT NULL REFERENCES account_profiles(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  favorite INTEGER NOT NULL DEFAULT 0 CHECK(favorite IN (0, 1)),
  play_time_seconds INTEGER NOT NULL DEFAULT 0 CHECK(play_time_seconds >= 0),
  last_played_at TEXT,
  PRIMARY KEY(account_profile_id, game_id)
);

CREATE TABLE IF NOT EXISTS sessions (
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
  source TEXT NOT NULL CHECK(source IN ('rift', 'manual')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  app_profile_id TEXT NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
  account_profile_id TEXT REFERENCES account_profiles(id) ON DELETE SET NULL,
  game_id TEXT REFERENCES games(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('success', 'error', 'info')),
  message TEXT NOT NULL,
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  app_profile_id TEXT PRIMARY KEY REFERENCES app_profiles(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'de' CHECK(locale IN ('de', 'en')),
  theme TEXT NOT NULL DEFAULT 'dark' CHECK(theme IN ('dark', 'light', 'system')),
  accent TEXT NOT NULL DEFAULT '#45D6E8',
  heading_font TEXT NOT NULL DEFAULT 'Rubik',
  body_font TEXT NOT NULL DEFAULT 'Geist',
  scale_percent INTEGER NOT NULL DEFAULT 100 CHECK(scale_percent BETWEEN 85 AND 125),
  font_weight INTEGER NOT NULL DEFAULT 500 CHECK(font_weight IN (400, 500, 600, 700)),
  spacing TEXT NOT NULL DEFAULT 'comfortable' CHECK(spacing IN ('compact', 'comfortable', 'spacious')),
  background_image TEXT,
  selected_account_id TEXT REFERENCES account_profiles(id) ON DELETE SET NULL,
  selected_performance_profile_id TEXT REFERENCES performance_profiles(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_profiles (id, name) VALUES ('default', 'Rift');

INSERT OR IGNORE INTO performance_profiles
  (id, app_profile_id, name, profile_kind, target_fps, graphics_level, sample_interval_ms)
VALUES
  ('performance', NULL, 'Performance', 'performance', 120, 3, 1000),
  ('balanced', NULL, 'Balanced', 'balanced', 60, 6, 2000),
  ('quality', NULL, 'Quality', 'quality', 60, 10, 5000);

INSERT OR IGNORE INTO settings
  (app_profile_id, selected_performance_profile_id)
VALUES
  ('default', 'balanced');

INSERT OR IGNORE INTO schema_migrations (version) VALUES (1);
