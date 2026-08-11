import type {
  AccountGame,
  AccountInput,
  AccountProfile,
  Activity,
  ActivityInput,
  AppBootstrap,
  AppSettings,
  Game,
  GameInput,
  GameMetadata,
  LaunchReceipt,
  LaunchRequest,
  RobloxStatus,
  Session,
  SettingsInput,
  SystemSnapshot,
} from "./entities";

/**
 * The complete surface the UI is allowed to use.
 *
 * Two implementations exist and must stay interchangeable: the Tauri adapter
 * that invokes Rust commands, and the in-memory adapter used by the browser
 * preview and by tests.
 */
export interface BackendPort {
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
  fetchGameMetadata(placeId: string): Promise<GameMetadata>;
  syncGameMetadata(gameId: string, placeId: string): Promise<Game>;
  launchRoblox(input: LaunchRequest): Promise<LaunchReceipt>;
}
