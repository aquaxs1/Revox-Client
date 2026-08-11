import type {
  AccountGame,
  AccountInput,
  AccountProfile,
  Activity,
  ActivityInput,
  AppBootstrap,
  AppSettings,
  CatalogItem,
  DiscordStatus,
  FriendEntry,
  Game,
  GameInput,
  GameMetadata,
  GameServer,
  GameStats,
  GameSummary,
  LaunchReceipt,
  LaunchRequest,
  RobloxStatus,
  RobloxUser,
  Session,
  SettingsInput,
  SystemSnapshot,
  UserPresence,
  UserStats,
  WatchlistEntry,
  WatchlistInput,
  WatchlistSample,
} from "./entities";
import type { ExportFormat } from "./entities";

/**
 * The complete surface the UI is allowed to use.
 *
 * Two implementations exist and must stay interchangeable: the Tauri adapter
 * that invokes Rust commands, and the in-memory adapter used by the browser
 * preview and by tests.
 */
export interface BackendPort {
  // Local data
  getBootstrap(): Promise<AppBootstrap>;
  saveSettings(input: SettingsInput): Promise<AppSettings>;
  getRobloxStatus(): Promise<RobloxStatus>;
  getSystemSnapshot(): Promise<SystemSnapshot>;
  upsertAccount(input: AccountInput): Promise<AccountProfile>;
  deleteAccount(id: string, keepStats: boolean): Promise<void>;
  upsertGame(input: GameInput): Promise<Game>;
  deleteGame(id: string): Promise<void>;
  setFavorite(
    accountProfileId: string,
    gameId: string,
    favorite: boolean,
  ): Promise<AccountGame>;
  recordActivity(input: ActivityInput): Promise<Activity>;
  listSessions(): Promise<Session[]>;
  addToWatchlist(input: WatchlistInput): Promise<WatchlistEntry>;
  removeFromWatchlist(id: string): Promise<void>;
  listWatchlist(): Promise<WatchlistEntry[]>;
  listWatchlistSamples(watchlistId: string): Promise<WatchlistSample[]>;

  // Platform
  exportSessions(format: ExportFormat, path: string): Promise<string>;
  setAutostart(enabled: boolean): Promise<void>;
  /** Resolves to the new version, or `null` when already up to date. */
  checkForUpdate(): Promise<string | null>;
  discordStatus(): Promise<DiscordStatus>;
  discordConnect(): Promise<void>;
  discordClear(): Promise<void>;
  /** The Roblox account signed in on this machine, as a suggestion. */
  detectRobloxAccount(): Promise<RobloxUser | null>;

  // Public Roblox data
  fetchGameMetadata(placeId: string): Promise<GameMetadata>;
  syncGameMetadata(gameId: string, placeId: string): Promise<Game>;
  searchUsers(keyword: string): Promise<RobloxUser[]>;
  getUserStats(userId: string): Promise<UserStats>;
  getUserByUsername(username: string): Promise<RobloxUser>;
  getFriends(userId: string): Promise<FriendEntry[]>;
  getPresence(userIds: string[]): Promise<UserPresence[]>;
  searchGames(keyword: string): Promise<GameSummary[]>;
  getGameStats(universeId: string): Promise<GameStats>;
  getGameStatsForPlace(placeId: string): Promise<GameStats>;
  getGameServers(placeId: string): Promise<GameServer[]>;
  searchCatalog(keyword: string): Promise<CatalogItem[]>;
  getCatalogItem(assetId: string): Promise<CatalogItem>;

  // Launching
  launchRoblox(input: LaunchRequest): Promise<LaunchReceipt>;
}
