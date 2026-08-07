import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type PropsWithChildren,
} from "react";
import { initialState } from "../data/mockData";
import { parsePlaceId } from "../domain/roblox";
import type { AppState, AppearanceSettings, Game, PerformanceProfile } from "./types";

const STORAGE_KEY = "rift-companion-state-v1";

type Action =
  | { type: "select-game"; gameId: string }
  | { type: "toggle-favorite"; gameId: string }
  | { type: "add-game"; game: Game }
  | { type: "select-account"; accountId: string }
  | { type: "set-performance"; profileId: PerformanceProfile["id"] }
  | { type: "update-appearance"; patch: Partial<AppearanceSettings> }
  | { type: "record-launch"; gameId: string; success: boolean };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "select-game":
      return { ...state, selectedGameId: action.gameId };
    case "toggle-favorite":
      return {
        ...state,
        games: state.games.map((game) =>
          game.id === action.gameId
            ? { ...game, favorite: !game.favorite }
            : game,
        ),
      };
    case "add-game":
      if (state.games.some((game) => game.placeId === action.game.placeId)) {
        return state;
      }
      return {
        ...state,
        games: [...state.games, action.game],
        selectedGameId: action.game.id,
      };
    case "select-account":
      return { ...state, selectedAccountId: action.accountId };
    case "set-performance":
      return { ...state, performanceProfileId: action.profileId };
    case "update-appearance":
      return {
        ...state,
        appearance: { ...state.appearance, ...action.patch },
      };
    case "record-launch": {
      const timestamp = "Gerade eben";
      return {
        ...state,
        activity: [
          {
            id: `activity-${Date.now()}`,
            gameId: action.gameId,
            timestamp,
            success: action.success,
          },
          ...state.activity,
        ],
        games: state.games.map((game) =>
          game.id === action.gameId ? { ...game, lastPlayed: timestamp } : game,
        ),
      };
    }
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!Array.isArray(parsed.games) || !Array.isArray(parsed.accounts)) {
      return initialState;
    }
    return { ...initialState, ...parsed };
  } catch {
    return initialState;
  }
}

interface AppStoreValue {
  state: AppState;
  selectGame: (gameId: string) => void;
  toggleFavorite: (gameId: string) => void;
  addGame: (reference: string, title?: string) => boolean;
  selectAccount: (accountId: string) => void;
  setPerformanceProfile: (profileId: PerformanceProfile["id"]) => void;
  updateAppearance: (patch: Partial<AppearanceSettings>) => void;
  recordLaunch: (gameId: string, success: boolean) => void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addGame = useCallback((reference: string, title?: string) => {
    const placeId = parsePlaceId(reference);
    if (!placeId) return false;
    dispatch({
      type: "add-game",
      game: {
        id: `custom-${placeId}`,
        placeId,
        title: title?.trim() || `Roblox Spiel ${placeId}`,
        genre: "Eigene Spiele",
        description: "Von dir über eine offizielle Roblox-Referenz hinzugefügt.",
        thumbnail: "/covers/experience-grid.png",
        coverPosition: "100% 100%",
        accent: "#45d6e8",
        favorite: false,
        lastPlayed: null,
        playMinutes: 0,
      },
    });
    return true;
  }, []);

  const value = useMemo<AppStoreValue>(
    () => ({
      state,
      selectGame: (gameId) => dispatch({ type: "select-game", gameId }),
      toggleFavorite: (gameId) => dispatch({ type: "toggle-favorite", gameId }),
      addGame,
      selectAccount: (accountId) =>
        dispatch({ type: "select-account", accountId }),
      setPerformanceProfile: (profileId) =>
        dispatch({ type: "set-performance", profileId }),
      updateAppearance: (patch) =>
        dispatch({ type: "update-appearance", patch }),
      recordLaunch: (gameId, success) =>
        dispatch({ type: "record-launch", gameId, success }),
    }),
    [addGame, state],
  );

  return (
    <AppStoreContext.Provider value={value}>
      {children}
    </AppStoreContext.Provider>
  );
}

export function useAppStore(): AppStoreValue {
  const value = useContext(AppStoreContext);
  if (!value) {
    throw new Error("useAppStore muss innerhalb von AppStoreProvider verwendet werden");
  }
  return value;
}
