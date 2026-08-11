import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type PropsWithChildren,
} from "react";
import type { BackendPort } from "../contracts/commands";
import type {
  AccountInput,
  AppBootstrap,
  AppSettings,
  Game,
  LaunchReceipt,
  RobloxStatus,
  SettingsInput,
  SystemSnapshot,
  WatchKind,
  WatchlistInput,
} from "../contracts/entities";
import { parsePlaceId } from "../domain/roblox";
import { BackendError, toBackendError } from "../services/backend";
import { DEFAULT_SETTINGS } from "../services/memoryBackend";
import type { AppState } from "./types";

const INITIAL_STATE: AppState = {
  status: "loading",
  errorCode: null,
  settings: DEFAULT_SETTINGS,
  accounts: [],
  games: [],
  accountGames: [],
  sessions: [],
  activities: [],
  watchlist: [],
  robloxStatus: null,
  system: null,
};

type Action =
  | { type: "loaded"; bootstrap: AppBootstrap }
  | { type: "failed"; code: string }
  | { type: "settings"; settings: AppSettings }
  | { type: "roblox"; status: RobloxStatus }
  | { type: "system"; snapshot: SystemSnapshot };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "loaded":
      return {
        ...state,
        status: "ready",
        errorCode: null,
        settings: action.bootstrap.settings,
        accounts: action.bootstrap.accounts,
        games: action.bootstrap.games,
        accountGames: action.bootstrap.accountGames,
        sessions: action.bootstrap.sessions,
        activities: action.bootstrap.activities,
        watchlist: action.bootstrap.watchlist,
      };
    case "failed":
      return { ...state, status: "error", errorCode: action.code };
    case "settings":
      return { ...state, settings: action.settings };
    case "roblox":
      return { ...state, robloxStatus: action.status };
    case "system":
      return { ...state, system: action.snapshot };
  }
}

export interface AddGameResult {
  game: Game;
  /** True when Roblox metadata could not be fetched and a placeholder is used. */
  metadataFailed: boolean;
}

interface AppStoreValue {
  state: AppState;
  /**
   * The raw port, for the read-only Roblox views.
   *
   * Explorer and Friends render live lookups that are never stored, so routing
   * them through the reducer would only add churn.
   */
  backend: BackendPort;
  reload: () => Promise<void>;
  saveSettings: (patch: SettingsInput) => Promise<void>;
  addGame: (reference: string) => Promise<AddGameResult>;
  removeGame: (gameId: string) => Promise<void>;
  refreshGame: (game: Game) => Promise<void>;
  toggleFavorite: (gameId: string) => Promise<void>;
  isFavorite: (gameId: string) => boolean;
  playtimeSeconds: (gameId: string) => number;
  saveAccount: (input: AccountInput) => Promise<void>;
  deleteAccount: (id: string, keepStats: boolean) => Promise<void>;
  selectAccount: (id: string) => Promise<void>;
  launch: (game: Game, gameInstanceId?: string | null) => Promise<LaunchReceipt>;
  launchPlace: (
    placeId: string,
    gameInstanceId?: string | null,
  ) => Promise<LaunchReceipt>;
  addWatch: (input: WatchlistInput) => Promise<void>;
  linkRobloxAccount: (username: string) => Promise<void>;
  unlinkRobloxAccount: () => Promise<void>;
  removeWatch: (id: string) => Promise<void>;
  isWatched: (kind: WatchKind, targetId: string) => boolean;
  refreshRobloxStatus: () => Promise<void>;
  refreshSystem: () => Promise<void>;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({
  backend,
  children,
}: PropsWithChildren<{ backend: BackendPort }>) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  // Actions read the freshest state without being re-created on every render.
  const latest = useRef(state);
  latest.current = state;

  const reload = useCallback(async () => {
    try {
      dispatch({ type: "loaded", bootstrap: await backend.getBootstrap() });
    } catch (reason) {
      dispatch({ type: "failed", code: toBackendError(reason).code });
    }
  }, [backend]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const refreshRobloxStatus = useCallback(async () => {
    try {
      dispatch({ type: "roblox", status: await backend.getRobloxStatus() });
    } catch {
      // A failed probe leaves the previous status in place; the status chip
      // shows "check failed" only when the backend says so explicitly.
    }
  }, [backend]);

  const refreshSystem = useCallback(async () => {
    try {
      dispatch({ type: "system", snapshot: await backend.getSystemSnapshot() });
    } catch {
      // Same reasoning as above: never replace real values with guesses.
    }
  }, [backend]);

  const saveSettings = useCallback(
    async (patch: SettingsInput) => {
      const settings = await backend.saveSettings(patch);
      dispatch({ type: "settings", settings });
    },
    [backend],
  );

  const addGame = useCallback(
    async (reference: string): Promise<AddGameResult> => {
      const placeId = parsePlaceId(reference);
      if (!placeId) {
        throw new BackendError("INVALID_PLACE_ID", "Not a Place ID or Roblox link");
      }

      // Try Roblox first so the card carries the real name and icon. If that
      // fails the game is still saved, just with a placeholder name.
      let metadataFailed = false;
      let name = `Roblox ${placeId}`;
      let description = "";
      let imageUrl: string | null = null;
      try {
        const metadata = await backend.fetchGameMetadata(placeId);
        name = metadata.name;
        description = metadata.description;
        imageUrl = metadata.iconUrl;
      } catch {
        metadataFailed = true;
      }

      const game = await backend.upsertGame({
        placeId,
        name,
        description,
        imageUrl,
        tags: [],
      });
      await reload();
      return { game, metadataFailed };
    },
    [backend, reload],
  );

  const removeGame = useCallback(
    async (gameId: string) => {
      await backend.deleteGame(gameId);
      await reload();
    },
    [backend, reload],
  );

  const refreshGame = useCallback(
    async (game: Game) => {
      await backend.syncGameMetadata(game.id, game.placeId);
      await reload();
    },
    [backend, reload],
  );

  const isFavorite = useCallback(
    (gameId: string) =>
      latest.current.accountGames.some(
        (entry) =>
          entry.gameId === gameId &&
          entry.accountProfileId === latest.current.settings.selectedAccountId &&
          entry.favorite,
      ),
    [],
  );

  const playtimeSeconds = useCallback(
    (gameId: string) =>
      latest.current.accountGames
        .filter((entry) => entry.gameId === gameId)
        .reduce((sum, entry) => sum + entry.playTimeSeconds, 0),
    [],
  );

  const toggleFavorite = useCallback(
    async (gameId: string) => {
      const accountId = latest.current.settings.selectedAccountId;
      if (!accountId) {
        throw new BackendError(
          "ACCOUNT_NOT_FOUND",
          "Select a local profile before bookmarking a game",
        );
      }
      await backend.setFavorite(accountId, gameId, !isFavorite(gameId));
      await reload();
    },
    [backend, isFavorite, reload],
  );

  const saveAccount = useCallback(
    async (input: AccountInput) => {
      const account = await backend.upsertAccount(input);
      // The first profile becomes the active one, so bookmarking works
      // immediately after onboarding.
      if (!latest.current.settings.selectedAccountId) {
        await backend.saveSettings({ selectedAccountId: account.id });
      }
      await reload();
    },
    [backend, reload],
  );

  const deleteAccount = useCallback(
    async (id: string, keepStats: boolean) => {
      await backend.deleteAccount(id, keepStats);
      if (latest.current.settings.selectedAccountId === id) {
        const next =
          latest.current.accounts.find((account) => account.id !== id)?.id ?? null;
        await backend.saveSettings({ selectedAccountId: next });
      }
      await reload();
    },
    [backend, reload],
  );

  const selectAccount = useCallback(
    async (id: string) => {
      await saveSettings({ selectedAccountId: id });
    },
    [saveSettings],
  );

  const launch = useCallback(
    async (game: Game, gameInstanceId: string | null = null) => {
      const receipt = await backend.launchRoblox({
        placeId: game.placeId,
        gameId: game.id,
        accountProfileId: latest.current.settings.selectedAccountId,
        gameInstanceId,
      });
      await reload();
      return receipt;
    },
    [backend, reload],
  );

  /**
   * Launches a place that is not in the library — joining a friend, a server
   * from the stats viewer, or an old session whose game was removed.
   */
  const launchPlace = useCallback(
    async (placeId: string, gameInstanceId: string | null = null) => {
      const known = latest.current.games.find((game) => game.placeId === placeId);
      const receipt = await backend.launchRoblox({
        placeId,
        gameId: known?.id ?? null,
        accountProfileId: latest.current.settings.selectedAccountId,
        gameInstanceId,
      });
      await reload();
      return receipt;
    },
    [backend, reload],
  );

  const addWatch = useCallback(
    async (input: WatchlistInput) => {
      await backend.addToWatchlist(input);
      await reload();
    },
    [backend, reload],
  );

  const removeWatch = useCallback(
    async (id: string) => {
      await backend.removeFromWatchlist(id);
      await reload();
    },
    [backend, reload],
  );

  /** Resolves a username to its public profile and stores the ID. */
  const linkRobloxAccount = useCallback(
    async (username: string) => {
      const user = await backend.getUserByUsername(username);
      await saveSettings({ robloxUserId: user.id, robloxUsername: user.name });
    },
    [backend, saveSettings],
  );

  const unlinkRobloxAccount = useCallback(
    async () => saveSettings({ robloxUserId: null, robloxUsername: null }),
    [saveSettings],
  );

  const isWatched = useCallback(
    (kind: WatchKind, targetId: string) =>
      latest.current.watchlist.some(
        (entry) => entry.kind === kind && entry.targetId === targetId,
      ),
    [],
  );

  const value = useMemo<AppStoreValue>(
    () => ({
      state,
      backend,
      reload,
      saveSettings,
      addGame,
      removeGame,
      refreshGame,
      toggleFavorite,
      isFavorite,
      playtimeSeconds,
      saveAccount,
      deleteAccount,
      selectAccount,
      launch,
      launchPlace,
      addWatch,
      removeWatch,
      isWatched,
      linkRobloxAccount,
      unlinkRobloxAccount,
      refreshRobloxStatus,
      refreshSystem,
    }),
    [
      addGame,
      addWatch,
      backend,
      deleteAccount,
      isFavorite,
      isWatched,
      launch,
      launchPlace,
      linkRobloxAccount,
      removeWatch,
      unlinkRobloxAccount,
      playtimeSeconds,
      refreshGame,
      refreshRobloxStatus,
      refreshSystem,
      reload,
      removeGame,
      saveAccount,
      saveSettings,
      selectAccount,
      state,
      toggleFavorite,
    ],
  );

  return (
    <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
  );
}

export function useAppStore(): AppStoreValue {
  const value = useContext(AppStoreContext);
  if (!value) {
    throw new Error("useAppStore must be used inside an AppStoreProvider");
  }
  return value;
}

/** The currently selected local profile, or `null` when none exists yet. */
export function useSelectedAccount() {
  const { state } = useAppStore();
  return (
    state.accounts.find(
      (account) => account.id === state.settings.selectedAccountId,
    ) ?? null
  );
}
