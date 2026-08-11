import type { Locale } from "../i18n/types";

export type ThemeMode = "dark" | "light" | "system";
export type Spacing = "compact" | "comfortable" | "spacious";

/** Mirrors `contracts::AppSettings` in the Rust backend. */
export interface AppSettings {
  locale: Locale;
  theme: ThemeMode;
  accent: string;
  spacing: Spacing;
  sidebarExpanded: boolean;
  onboardingComplete: boolean;
  robuxSpent: number;
  selectedAccountId: string | null;
  /** Playtime recording is off until the user turns it on. */
  statsTrackingEnabled: boolean;
  /** A public Roblox profile the friends screen reads. Never a login. */
  robloxUserId: string | null;
  robloxUsername: string | null;
  minimizeToTray: boolean;
  autostartEnabled: boolean;
  notifyFriends: boolean;
  discordEnabled: boolean;
  discordApplicationId: string | null;
}

/** Every field optional: patches touch only what they carry. */
export interface SettingsInput {
  locale?: Locale;
  theme?: ThemeMode;
  accent?: string;
  spacing?: Spacing;
  sidebarExpanded?: boolean;
  onboardingComplete?: boolean;
  robuxSpent?: number;
  selectedAccountId?: string | null;
  statsTrackingEnabled?: boolean;
  robloxUserId?: string | null;
  robloxUsername?: string | null;
  minimizeToTray?: boolean;
  autostartEnabled?: boolean;
  notifyFriends?: boolean;
  discordEnabled?: boolean;
  discordApplicationId?: string | null;
}

export interface AccountProfile {
  id: string;
  username: string;
  label: string;
  initials: string;
  color: string;
  note: string;
  avatarUrl: string | null;
}

export interface AccountInput {
  id?: string | null;
  username: string;
  label: string;
  color: string;
  note: string;
  avatarUrl?: string | null;
}

export interface Game {
  id: string;
  placeId: string;
  name: string;
  description: string;
  imageUrl: string | null;
  tags: string[];
  universeId: string | null;
  playing: number | null;
  visits: number | null;
  lastLaunchedAt: string | null;
}

export interface GameInput {
  id?: string | null;
  placeId: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  tags: string[];
}

export interface AccountGame {
  accountProfileId: string;
  gameId: string;
  favorite: boolean;
  playTimeSeconds: number;
  lastPlayedAt: string | null;
}

export interface Session {
  id: string;
  accountProfileId: string | null;
  gameId: string | null;
  placeId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  result: "running" | "completed" | "launchTimedOut" | "possibleCrash";
  possibleCrash: boolean;
  source: "revox" | "manual";
  gameInstanceId: string | null;
}

export interface Activity {
  id: string;
  accountProfileId: string | null;
  gameId: string | null;
  kind: string;
  status: "success" | "error" | "info";
  message: string;
  errorCode: string | null;
  createdAt: string;
}

export interface ActivityInput {
  accountProfileId: string | null;
  gameId: string | null;
  kind: string;
  status: "success" | "error" | "info";
  message: string;
  errorCode: string | null;
}

export interface AppBootstrap {
  settings: AppSettings;
  accounts: AccountProfile[];
  games: Game[];
  accountGames: AccountGame[];
  sessions: Session[];
  activities: Activity[];
  watchlist: WatchlistEntry[];
}

export type RobloxState = "ready" | "notFound" | "running" | "checkFailed";

export interface RobloxStatus {
  state: RobloxState;
  installationPath: string | null;
  detail: string | null;
}

/**
 * Anything the backend could not measure safely stays `null` and the UI shows
 * "not available" instead of a made-up number.
 */
export interface SystemSnapshot {
  osName: string | null;
  cpuName: string | null;
  cpuCores: number | null;
  cpuUsagePercent: number | null;
  memoryTotalBytes: number | null;
  memoryUsedBytes: number | null;
  gpuName: string | null;
  gpuUsagePercent: number | null;
}

export interface LaunchRequest {
  placeId: string;
  gameId: string | null;
  accountProfileId: string | null;
  /** Set to rejoin one specific server instead of any public server. */
  gameInstanceId?: string | null;
}

export interface LaunchReceipt {
  uri: string;
  activityId: string;
  acceptedAt: string;
}

export interface GameMetadata {
  placeId: string;
  universeId: string;
  name: string;
  description: string;
  iconUrl: string | null;
  playing: number | null;
  visits: number | null;
}

// ---------------------------------------------------------------- explorer --

export type WatchKind = "user" | "game" | "asset";

export interface WatchlistEntry {
  id: string;
  kind: WatchKind;
  targetId: string;
  label: string;
  imageUrl: string | null;
  createdAt: string;
}

export interface WatchlistInput {
  kind: WatchKind;
  targetId: string;
  label: string;
  imageUrl: string | null;
}

export interface RobloxUser {
  id: string;
  name: string;
  displayName: string;
  description: string;
  created: string | null;
  accountAgeDays: number | null;
  hasVerifiedBadge: boolean;
  isBanned: boolean;
  avatarUrl: string | null;
}

export type PresenceState = "offline" | "online" | "inGame" | "inStudio" | "unknown";

/**
 * Where a user is right now, as far as Roblox tells an anonymous caller.
 *
 * `placeId` and `gameInstanceId` are often null: Roblox only reveals them when
 * the user's join privacy allows it, so the join button appears only when both
 * are actually present.
 */
export interface UserPresence {
  userId: string;
  state: PresenceState;
  lastLocation: string | null;
  placeId: string | null;
  rootPlaceId: string | null;
  gameInstanceId: string | null;
  universeId: string | null;
  lastOnline: string | null;
}

export interface UserStats {
  user: RobloxUser;
  followers: number | null;
  following: number | null;
  friends: number | null;
  groups: number | null;
  presence: UserPresence | null;
}

export interface FriendEntry {
  user: RobloxUser;
  presence: UserPresence | null;
}

export interface GameStats {
  universeId: string;
  rootPlaceId: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  creatorType: string;
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  upVotes: number | null;
  downVotes: number | null;
  maxPlayers: number | null;
  created: string | null;
  updated: string | null;
  genre: string | null;
  price: number | null;
  iconUrl: string | null;
}

export interface GameSummary {
  universeId: string;
  rootPlaceId: string;
  name: string;
  creatorName: string;
  playing: number | null;
  upVotes: number | null;
  downVotes: number | null;
  iconUrl: string | null;
}

export interface GameServer {
  id: string;
  playing: number;
  maxPlayers: number;
  fps: number | null;
  ping: number | null;
}

export interface CatalogItem {
  id: string;
  itemType: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  price: number | null;
  lowestPrice: number | null;
  favoriteCount: number | null;
  isLimited: boolean;
  isLimitedUnique: boolean;
  unitsAvailable: number | null;
  created: string | null;
  imageUrl: string | null;
  recentAveragePrice: number | null;
  originalPrice: number | null;
  sales: number | null;
  numberRemaining: number | null;
}

/** One numeric reading of one watched target. */
export interface WatchlistSample {
  watchlistId: string;
  capturedAt: string;
  metric: string;
  value: number;
}

export type ExportFormat = "csv" | "json";

/** Raised by the friends poller when someone comes online or starts a game. */
export type FriendEvent =
  | { cameOnline: { userId: string; name: string } }
  | { startedPlaying: { userId: string; name: string; game: string } };

export interface DiscordStatus {
  /** True when this build ships a Revox Discord application. */
  builtInAvailable: boolean;
  connected: boolean;
}
