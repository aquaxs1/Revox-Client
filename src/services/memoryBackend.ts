import type { BackendPort } from "../contracts/commands";
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
  LaunchRequest,
  Session,
  SettingsInput,
  WatchlistEntry,
  WatchlistInput,
} from "../contracts/entities";
import { buildLaunchUrl, validPlaceId } from "../domain/roblox";
import { BackendError } from "./backend";

const STORAGE_KEY = "revox-preview-v1";

interface PreviewData {
  settings: AppSettings;
  accounts: AccountProfile[];
  games: Game[];
  accountGames: AccountGame[];
  sessions: Session[];
  activities: Activity[];
  watchlist: WatchlistEntry[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: "de",
  theme: "dark",
  accent: "#2E9BF0",
  spacing: "comfortable",
  sidebarExpanded: true,
  onboardingComplete: false,
  robuxSpent: 0,
  selectedAccountId: null,
  statsTrackingEnabled: false,
  robloxUserId: null,
  robloxUsername: null,
};

function emptyData(): PreviewData {
  return {
    settings: { ...DEFAULT_SETTINGS },
    accounts: [],
    games: [],
    accountGames: [],
    sessions: [],
    activities: [],
    watchlist: [],
  };
}

/** Mirrors `initials_for` in the Rust repository so both sides agree. */
export function initialsFor(username: string, label: string): string {
  const source = username.trim() ? username : label;
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) {
    const letters = [...source].filter((character) => /[\p{L}\p{N}]/u.test(character));
    return letters.slice(0, 2).join("").toUpperCase() || "?";
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Mirrors `normalize_tags` in the Rust repository. */
export function normalizeTags(tags: string[]): string[] {
  const seen: string[] = [];
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (!normalized || [...normalized].length > 24) continue;
    if (!seen.includes(normalized)) seen.push(normalized);
  }
  return seen;
}

export function validHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/**
 * A complete in-memory implementation of the backend port.
 *
 * It enforces the same validation rules as the Rust repository so the browser
 * preview behaves like the desktop app, and it gives the test suite a real
 * backend instead of a pile of mocks.
 */
export function createMemoryBackend(
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage ===
  "undefined"
    ? null
    : localStorage,
): BackendPort {
  let data = load();

  function load(): PreviewData {
    if (!storage) return emptyData();
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return emptyData();
      const parsed = JSON.parse(raw) as Partial<PreviewData>;
      return {
        ...emptyData(),
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      };
    } catch {
      return emptyData();
    }
  }

  function persist() {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // A full or unavailable storage must not break the preview.
    }
  }

  function bootstrap(): AppBootstrap {
    return {
      settings: { ...data.settings },
      accounts: [...data.accounts],
      games: [...data.games],
      accountGames: [...data.accountGames],
      sessions: [...data.sessions],
      activities: [...data.activities],
      watchlist: [...data.watchlist],
    };
  }

  /** Every Roblox lookup is blocked by CORS in a browser. */
  function offline(): never {
    throw new BackendError(
      "API_UNREACHABLE",
      "Roblox lookups are only available in the desktop app",
    );
  }

  return {
    async getBootstrap() {
      return bootstrap();
    },

    async saveSettings(input: SettingsInput) {
      if (input.locale && !["de", "en"].includes(input.locale)) {
        throw new BackendError("INVALID_LOCALE", "Locale must be de or en");
      }
      if (input.theme && !["dark", "light", "system"].includes(input.theme)) {
        throw new BackendError("INVALID_THEME", "Unknown theme");
      }
      if (
        input.spacing &&
        !["compact", "comfortable", "spacious"].includes(input.spacing)
      ) {
        throw new BackendError("INVALID_SPACING", "Unknown spacing");
      }
      if (input.accent && !validHexColor(input.accent)) {
        throw new BackendError("INVALID_ACCENT", "Accent must be a #RRGGBB hex color");
      }
      if (input.robuxSpent !== undefined && input.robuxSpent < 0) {
        throw new BackendError("INVALID_ROBUX", "Recorded Robux must not be negative");
      }
      if (
        input.robloxUserId !== undefined &&
        input.robloxUserId !== null &&
        !/^\d{1,20}$/.test(input.robloxUserId)
      ) {
        throw new BackendError(
          "INVALID_ROBLOX_ID",
          "A Roblox user ID must contain 1 to 20 digits",
        );
      }

      data.settings = { ...data.settings, ...input };
      persist();
      return { ...data.settings };
    },

    async getRobloxStatus() {
      return {
        state: "notFound" as const,
        installationPath: null,
        detail: "Browser preview cannot inspect the local machine",
      };
    },

    async getSystemSnapshot() {
      // A browser cannot measure the host, and inventing numbers is exactly
      // what this project refuses to do.
      return {
        osName: null,
        cpuName: null,
        cpuCores: null,
        cpuUsagePercent: null,
        memoryTotalBytes: null,
        memoryUsedBytes: null,
        gpuName: null,
        gpuUsagePercent: null,
      };
    },

    async upsertAccount(input: AccountInput) {
      const username = input.username.trim();
      if (!username || username.length > 40) {
        throw new BackendError(
          "INVALID_USERNAME",
          "Username must contain 1 to 40 characters",
        );
      }
      if (!validHexColor(input.color)) {
        throw new BackendError("INVALID_COLOR", "Color must be a #RRGGBB hex color");
      }

      const label = input.label.trim();
      const account: AccountProfile = {
        id: input.id ?? randomId(),
        username,
        label,
        initials: initialsFor(username, label),
        color: input.color.toUpperCase(),
        note: input.note,
        avatarUrl: input.avatarUrl ?? null,
      };
      const index = data.accounts.findIndex((entry) => entry.id === account.id);
      if (index >= 0) {
        data.accounts[index] = account;
      } else {
        data.accounts.push(account);
      }
      persist();
      return account;
    },

    async deleteAccount(id: string, keepStats: boolean) {
      if (!data.accounts.some((account) => account.id === id)) {
        throw new BackendError("ACCOUNT_NOT_FOUND", "Account profile not found");
      }
      data.accounts = data.accounts.filter((account) => account.id !== id);
      data.accountGames = data.accountGames.filter(
        (entry) => entry.accountProfileId !== id,
      );
      data.sessions = keepStats
        ? data.sessions.map((session) =>
            session.accountProfileId === id
              ? { ...session, accountProfileId: null }
              : session,
          )
        : data.sessions.filter((session) => session.accountProfileId !== id);
      if (data.settings.selectedAccountId === id) {
        data.settings.selectedAccountId = data.accounts[0]?.id ?? null;
      }
      persist();
    },

    async upsertGame(input: GameInput) {
      if (!validPlaceId(input.placeId)) {
        throw new BackendError(
          "INVALID_PLACE_ID",
          "Place ID must contain 1 to 20 ASCII digits",
        );
      }
      const existing = data.games.find((game) => game.placeId === input.placeId);
      const game: Game = {
        id: input.id ?? existing?.id ?? randomId(),
        placeId: input.placeId,
        name: input.name.trim(),
        description: input.description,
        imageUrl: input.imageUrl ?? existing?.imageUrl ?? null,
        tags: normalizeTags(input.tags),
        universeId: existing?.universeId ?? null,
        playing: existing?.playing ?? null,
        visits: existing?.visits ?? null,
        lastLaunchedAt: existing?.lastLaunchedAt ?? null,
      };
      const index = data.games.findIndex((entry) => entry.id === game.id);
      if (index >= 0) {
        data.games[index] = game;
      } else {
        data.games.push(game);
      }
      persist();
      return game;
    },

    async deleteGame(id: string) {
      if (!data.games.some((game) => game.id === id)) {
        throw new BackendError("GAME_NOT_FOUND", "Game not found");
      }
      data.games = data.games.filter((game) => game.id !== id);
      data.accountGames = data.accountGames.filter((entry) => entry.gameId !== id);
      persist();
    },

    async setFavorite(accountProfileId: string, gameId: string, favorite: boolean) {
      const index = data.accountGames.findIndex(
        (entry) => entry.accountProfileId === accountProfileId && entry.gameId === gameId,
      );
      const entry: AccountGame = {
        accountProfileId,
        gameId,
        favorite,
        playTimeSeconds: index >= 0 ? data.accountGames[index].playTimeSeconds : 0,
        lastPlayedAt: index >= 0 ? data.accountGames[index].lastPlayedAt : null,
      };
      if (index >= 0) {
        data.accountGames[index] = entry;
      } else {
        data.accountGames.push(entry);
      }
      persist();
      return entry;
    },

    async recordActivity(input: ActivityInput) {
      const activity: Activity = {
        ...input,
        id: randomId(),
        createdAt: new Date().toISOString(),
      };
      data.activities = [activity, ...data.activities].slice(0, 100);
      persist();
      return activity;
    },

    async listSessions(): Promise<Session[]> {
      return [...data.sessions];
    },

    async addToWatchlist(input: WatchlistInput) {
      if (!["user", "game", "asset"].includes(input.kind)) {
        throw new BackendError("INVALID_WATCHLIST_KIND", "Unknown watchlist kind");
      }
      if (!/^\d{1,20}$/.test(input.targetId)) {
        throw new BackendError("INVALID_ROBLOX_ID", "A Roblox ID must be numeric");
      }
      const existing = data.watchlist.find(
        (entry) => entry.kind === input.kind && entry.targetId === input.targetId,
      );
      const entry: WatchlistEntry = {
        id: existing?.id ?? randomId(),
        kind: input.kind,
        targetId: input.targetId,
        label: input.label.trim(),
        imageUrl: input.imageUrl,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      data.watchlist = existing
        ? data.watchlist.map((item) => (item.id === entry.id ? entry : item))
        : [entry, ...data.watchlist];
      persist();
      return entry;
    },

    async removeFromWatchlist(id: string) {
      if (!data.watchlist.some((entry) => entry.id === id)) {
        throw new BackendError(
          "WATCHLIST_ENTRY_NOT_FOUND",
          "This watchlist entry no longer exists",
        );
      }
      data.watchlist = data.watchlist.filter((entry) => entry.id !== id);
      persist();
    },

    async listWatchlist() {
      return [...data.watchlist];
    },

    // Roblox blocks browser-origin requests, so the preview cannot reach any of
    // these. The desktop build performs them in Rust.
    async fetchGameMetadata() {
      return offline();
    },
    async syncGameMetadata() {
      return offline();
    },
    async searchUsers() {
      return offline();
    },
    async getUserStats() {
      return offline();
    },
    async getUserByUsername() {
      return offline();
    },
    async getFriends() {
      return offline();
    },
    async getPresence() {
      return offline();
    },
    async searchGames() {
      return offline();
    },
    async getGameStats() {
      return offline();
    },
    async getGameStatsForPlace() {
      return offline();
    },
    async getGameServers() {
      return offline();
    },
    async searchCatalog() {
      return offline();
    },
    async getCatalogItem() {
      return offline();
    },

    async launchRoblox(input: LaunchRequest) {
      const uri = buildLaunchUrl(input.placeId, input.gameInstanceId ?? null);
      const activity = await this.recordActivity({
        accountProfileId: input.accountProfileId,
        gameId: input.gameId,
        kind: "launch",
        status: "info",
        message: `Browser preview: would hand place ${input.placeId} to Roblox`,
        errorCode: null,
      });
      return { uri, activityId: activity.id, acceptedAt: new Date().toISOString() };
    },
  };
}
