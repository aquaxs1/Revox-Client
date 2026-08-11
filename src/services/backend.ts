import type { BackendPort } from "../contracts/commands";
import type {
  AccountGame,
  AccountProfile,
  Activity,
  AppBootstrap,
  AppSettings,
  Game,
  GameMetadata,
  LaunchReceipt,
  RobloxStatus,
  Session,
  SystemSnapshot,
} from "../contracts/entities";

export type InvokeFunction = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

/** A backend failure carrying the Rust error code, so the UI can localize it. */
export class BackendError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

export function toBackendError(reason: unknown): BackendError {
  if (
    typeof reason === "object" &&
    reason !== null &&
    "code" in reason &&
    "message" in reason &&
    typeof reason.code === "string" &&
    typeof reason.message === "string"
  ) {
    return new BackendError(reason.code, reason.message);
  }

  return new BackendError(
    "UNEXPECTED",
    reason instanceof Error ? reason.message : "Unexpected backend error",
  );
}

async function call<T>(
  invoke: InvokeFunction,
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return (await invoke(command, args)) as T;
  } catch (reason) {
    throw toBackendError(reason);
  }
}

/**
 * Binds the port to Rust commands.
 *
 * Argument names must match the `#[tauri::command]` parameters exactly; Tauri
 * converts snake_case parameters to camelCase on the JavaScript side.
 */
export function createTauriBackend(invoke: InvokeFunction): BackendPort {
  return {
    getBootstrap: () => call<AppBootstrap>(invoke, "get_bootstrap"),
    saveSettings: (input) => call<AppSettings>(invoke, "save_settings", { input }),
    getRobloxStatus: () => call<RobloxStatus>(invoke, "get_roblox_status"),
    getSystemSnapshot: () => call<SystemSnapshot>(invoke, "get_system_snapshot"),
    upsertAccount: (input) => call<AccountProfile>(invoke, "upsert_account", { input }),
    deleteAccount: (id, keepStats) =>
      call<void>(invoke, "delete_account", { id, keepStats }),
    upsertGame: (input) => call<Game>(invoke, "upsert_game", { input }),
    deleteGame: (id) => call<void>(invoke, "delete_game", { id }),
    setFavorite: (accountProfileId, gameId, favorite) =>
      call<AccountGame>(invoke, "set_favorite", {
        accountProfileId,
        gameId,
        favorite,
      }),
    recordActivity: (input) => call<Activity>(invoke, "record_activity", { input }),
    listSessions: () => call<Session[]>(invoke, "list_sessions"),
    fetchGameMetadata: (placeId) =>
      call<GameMetadata>(invoke, "fetch_game_metadata", { placeId }),
    syncGameMetadata: (gameId, placeId) =>
      call<Game>(invoke, "sync_game_metadata", { gameId, placeId }),
    launchRoblox: (input) => call<LaunchReceipt>(invoke, "launch_roblox", { input }),
  };
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}
