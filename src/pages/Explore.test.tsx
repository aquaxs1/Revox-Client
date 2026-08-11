import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../App";
import type { BackendPort } from "../contracts/commands";
import type { CatalogItem, GameStats, UserStats } from "../contracts/entities";
import { createMemoryBackend } from "../services/memoryBackend";

/**
 * The Explorer's detail views only ever render live Roblox data, which the
 * browser preview cannot fetch. These tests stand in for that: a stub backend
 * feeds realistic responses so the derived figures and the "not available"
 * fallbacks are covered.
 */
function backendWith(overrides: Partial<BackendPort>): BackendPort {
  const base = createMemoryBackend(null);
  return { ...base, ...overrides } as BackendPort;
}

const userStats: UserStats = {
  user: {
    id: "261",
    name: "Shedletsky",
    displayName: "Shedletsky",
    description: "Hello there.",
    created: "2006-02-27T00:00:00.000Z",
    accountAgeDays: 7470,
    hasVerifiedBadge: true,
    isBanned: false,
    avatarUrl: null,
  },
  followers: 1000,
  following: 20,
  friends: 50,
  groups: 7,
  presence: {
    userId: "261",
    state: "inGame",
    lastLocation: "Doors",
    placeId: "920587237",
    rootPlaceId: "920587237",
    gameInstanceId: "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0",
    universeId: "111",
    lastOnline: null,
  },
};

const gameStats: GameStats = {
  universeId: "111",
  rootPlaceId: "920587237",
  name: "Doors",
  description: "A hotel.",
  creatorId: "9",
  creatorName: "LSPLASH",
  creatorType: "Group",
  playing: 100,
  visits: 10_000,
  favorites: 500,
  upVotes: 900,
  downVotes: 100,
  maxPlayers: 12,
  created: "2022-01-01T00:00:00.000Z",
  updated: "2026-01-01T00:00:00.000Z",
  genre: "Horror",
  price: null,
  iconUrl: null,
};

const limitedItem: CatalogItem = {
  id: "1365767",
  itemType: "Asset",
  name: "Dominus Empyreus",
  description: "",
  creatorId: "1",
  creatorName: "Roblox",
  price: null,
  lowestPrice: 12_000_000,
  favoriteCount: 9000,
  isLimited: true,
  isLimitedUnique: false,
  unitsAvailable: null,
  created: "2008-01-01T00:00:00.000Z",
  imageUrl: null,
  recentAveragePrice: 15_000,
  originalPrice: 10_000,
  sales: 26,
  numberRemaining: null,
};

/** Reads the value of one labelled fact tile. */
function factValue(label: string): string {
  const tile = screen.getByText(label).closest(".rv-fact");
  return tile?.querySelector("strong")?.textContent ?? "";
}

async function openExplorer(backend: BackendPort, tab: string, query: string) {
  await backend.saveSettings({ onboardingComplete: true });
  render(<App backend={backend} />);
  await userEvent.click(await screen.findByRole("button", { name: "Explorer" }));
  if (tab !== "Profile") {
    await userEvent.click(screen.getByRole("button", { name: tab }));
  }
  const field = screen.getByRole("textbox");
  await userEvent.type(field, query);
  await userEvent.click(screen.getByRole("button", { name: "Suchen" }));
}

describe("the profile view", () => {
  it("shows Roblox counters plus the derived follower ratio", async () => {
    const backend = backendWith({ getUserStats: async () => userStats });

    await openExplorer(backend, "Profile", "261");

    expect(await screen.findByText("Shedletsky")).toBeInTheDocument();
    expect(factValue("Follower")).toBe("1.000");
    // 1000 followers over 50 friends.
    expect(factValue("Follower je Freund")).toBe("20.0");
    expect(factValue("Kontoalter")).toBe("7.470 Tage");
  });

  it("offers a join button only when Roblox published the server", async () => {
    const joinable = backendWith({ getUserStats: async () => userStats });
    await openExplorer(joinable, "Profile", "261");
    expect(await screen.findByRole("button", { name: "Beitreten" })).toBeInTheDocument();
  });

  it("explains a hidden server instead of showing a dead button", async () => {
    const hidden = backendWith({
      getUserStats: async () => ({
        ...userStats,
        presence: { ...userStats.presence!, gameInstanceId: null },
      }),
    });

    await openExplorer(hidden, "Profile", "261");

    expect(
      await screen.findByText(
        "Roblox gibt den Serverort dieses Profils nicht öffentlich preis.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Beitreten" })).not.toBeInTheDocument();
  });

  it("marks counters Roblox withheld as not available", async () => {
    const partial = backendWith({
      getUserStats: async () => ({
        ...userStats,
        followers: null,
        friends: null,
        groups: null,
      }),
    });

    await openExplorer(partial, "Profile", "261");

    await screen.findByText("Shedletsky");
    expect(factValue("Follower")).toBe("Nicht verfügbar");
    expect(factValue("Gruppen")).toBe("Nicht verfügbar");
    // A missing count must not silently become a zero ratio.
    expect(factValue("Follower je Freund")).toBe("Nicht verfügbar");
  });
});

describe("the experience view", () => {
  it("shows the like ratio and visits per active player", async () => {
    const backend = backendWith({
      getGameStatsForPlace: async () => gameStats,
      getGameServers: async () => [
        { id: "a", playing: 12, maxPlayers: 12, fps: 60, ping: 40 },
        { id: "b", playing: 6, maxPlayers: 12, fps: 60, ping: 55 },
      ],
    });

    await openExplorer(backend, "Spiele", "920587237");

    expect(await screen.findByText("Doors")).toBeInTheDocument();
    // 900 of 1000 votes are positive.
    expect(factValue("Like-Verhältnis")).toBe("90.0 %");
    // 10 000 visits over 100 active players.
    expect(factValue("Besuche je aktivem Spieler")).toBe("100");
    expect(factValue("Genre")).toBe("Horror");
  });

  it("summarizes the server list and can join one directly", async () => {
    const backend = backendWith({
      getGameStatsForPlace: async () => gameStats,
      getGameServers: async () => [
        { id: "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0", playing: 12, maxPlayers: 12, fps: 60, ping: 40 },
      ],
    });

    await openExplorer(backend, "Spiele", "920587237");

    expect(await screen.findByText(/1 volle Server/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Server beitreten" }),
    ).toBeInTheDocument();
  });

  it("still renders the stats when the server list fails", async () => {
    const backend = backendWith({
      getGameStatsForPlace: async () => gameStats,
      getGameServers: async () => {
        throw new Error("nope");
      },
    });

    await openExplorer(backend, "Spiele", "920587237");

    expect(await screen.findByText("Doors")).toBeInTheDocument();
    expect(await screen.findByText("Keine öffentlichen Server gefunden.")).toBeInTheDocument();
  });
});

describe("the catalog view", () => {
  it("shows resale figures and the markup over the original price", async () => {
    const backend = backendWith({ getCatalogItem: async () => limitedItem });

    await openExplorer(backend, "UGC & Katalog", "1365767");

    expect(await screen.findByText("Dominus Empyreus")).toBeInTheDocument();
    expect(screen.getByText("Limited")).toBeInTheDocument();
    // RAP of 15 000 against an original price of 10 000.
    expect(factValue("Aufschlag zum Ursprungspreis")).toBe("+50 %");
    expect(factValue("Preis")).toBe("Nicht im Verkauf");
    expect(factValue("Verbleibend")).toBe("Nicht verfügbar");
  });
});

describe("failures", () => {
  it("shows a readable message when Roblox rate limits the request", async () => {
    const backend = backendWith({
      getUserStats: async () => {
        throw { code: "API_RATE_LIMITED", message: "slow down" };
      },
    });

    await openExplorer(backend, "Profile", "261");

    expect(
      await screen.findByText("Roblox drosselt die Anfragen. Bitte kurz warten."),
    ).toBeInTheDocument();
  });

  it("points at the Place-ID path when game search is down", async () => {
    const backend = backendWith({
      searchGames: async () => {
        throw { code: "GAME_SEARCH_UNAVAILABLE", message: "down" };
      },
    });

    await openExplorer(backend, "Spiele", "doors");

    expect(
      await screen.findByText(
        "Die Roblox-Spielsuche antwortet gerade nicht. Nutze so lange eine Place-ID.",
      ),
    ).toBeInTheDocument();
  });
});

describe("the watchlist", () => {
  it("adds a profile and keeps it after leaving the detail view", async () => {
    const backend = backendWith({ getUserStats: async () => userStats });
    await openExplorer(backend, "Profile", "261");

    await userEvent.click(await screen.findByRole("button", { name: "Beobachten" }));
    await userEvent.click(screen.getByRole("button", { name: "Zurück zur Suche" }));

    const watchlist = await screen.findByRole("heading", { name: "Beobachtungsliste" });
    const section = watchlist.closest("section");
    expect(within(section!).getByText("Shedletsky")).toBeInTheDocument();
    expect((await backend.listWatchlist())[0].targetId).toBe("261");
  });
});
