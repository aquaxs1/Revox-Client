import { beforeEach, describe, expect, it } from "vitest";
import type { BackendPort } from "../contracts/commands";
import { BackendError } from "./backend";
import { createMemoryBackend, initialsFor, normalizeTags } from "./memoryBackend";

let backend: BackendPort;

beforeEach(() => {
  backend = createMemoryBackend(null);
});

const account = {
  username: "SebiMain",
  label: "Main",
  color: "#2E9BF0",
  note: "",
};

describe("bootstrap", () => {
  it("starts empty and un-onboarded", async () => {
    const bootstrap = await backend.getBootstrap();

    expect(bootstrap.settings.onboardingComplete).toBe(false);
    expect(bootstrap.accounts).toEqual([]);
    expect(bootstrap.games).toEqual([]);
    expect(bootstrap.sessions).toEqual([]);
  });
});

describe("settings", () => {
  it("patches only the fields it carries", async () => {
    await backend.saveSettings({ locale: "en" });
    const settings = await backend.saveSettings({ onboardingComplete: true });

    expect(settings.locale).toBe("en");
    expect(settings.onboardingComplete).toBe(true);
    expect(settings.theme).toBe("dark");
  });

  it("rejects values outside the allowed set", async () => {
    await expect(backend.saveSettings({ accent: "red" })).rejects.toBeInstanceOf(
      BackendError,
    );
    await expect(backend.saveSettings({ robuxSpent: -5 })).rejects.toBeInstanceOf(
      BackendError,
    );
  });
});

describe("accounts", () => {
  it("derives initials and uppercases the color", async () => {
    const created = await backend.upsertAccount(account);

    expect(created.initials).toBe("SE");
    expect(created.color).toBe("#2E9BF0");
  });

  it("rejects a blank username and a malformed color", async () => {
    await expect(
      backend.upsertAccount({ ...account, username: "   " }),
    ).rejects.toBeInstanceOf(BackendError);
    await expect(
      backend.upsertAccount({ ...account, color: "blue" }),
    ).rejects.toBeInstanceOf(BackendError);
  });

  it("clears the selection and favourites when the account is deleted", async () => {
    const created = await backend.upsertAccount(account);
    const game = await backend.upsertGame({
      placeId: "123",
      name: "Test",
      description: "",
      tags: [],
    });
    await backend.setFavorite(created.id, game.id, true);
    await backend.saveSettings({ selectedAccountId: created.id });

    await backend.deleteAccount(created.id, true);
    const bootstrap = await backend.getBootstrap();

    expect(bootstrap.accounts).toEqual([]);
    expect(bootstrap.accountGames).toEqual([]);
    expect(bootstrap.settings.selectedAccountId).toBeNull();
  });
});

describe("games", () => {
  it("rejects a non-numeric Place ID", async () => {
    await expect(
      backend.upsertGame({
        placeId: "123 & calc.exe",
        name: "Bad",
        description: "",
        tags: [],
      }),
    ).rejects.toBeInstanceOf(BackendError);
  });

  it("updates instead of duplicating when the same place is added twice", async () => {
    const first = await backend.upsertGame({
      placeId: "123",
      name: "First",
      description: "",
      tags: ["Obby", "obby"],
    });
    const second = await backend.upsertGame({
      placeId: "123",
      name: "Renamed",
      description: "",
      tags: [],
    });

    expect(second.id).toBe(first.id);
    expect(first.tags).toEqual(["obby"]);
    expect((await backend.getBootstrap()).games).toHaveLength(1);
  });
});

describe("launching in the browser preview", () => {
  it("returns the official protocol URL and records the attempt", async () => {
    const receipt = await backend.launchRoblox({
      placeId: "920587237",
      gameId: null,
      accountProfileId: null,
    });

    expect(receipt.uri).toBe("roblox://placeId=920587237");
    expect((await backend.getBootstrap()).activities).toHaveLength(1);
  });
});

describe("Roblox lookups in the browser preview", () => {
  it("report that they need the desktop app instead of returning fake data", async () => {
    const calls = [
      backend.fetchGameMetadata("123"),
      backend.searchUsers("builderman"),
      backend.getUserStats("261"),
      backend.getFriends("261"),
      backend.searchGames("doors"),
      backend.getGameStats("123"),
      backend.getGameServers("123"),
      backend.searchCatalog("hat"),
      backend.getCatalogItem("123"),
    ];

    for (const call of calls) {
      await expect(call).rejects.toMatchObject({ code: "API_UNREACHABLE" });
    }
  });
});

describe("the watchlist", () => {
  it("deduplicates a target and refreshes its label", async () => {
    const first = await backend.addToWatchlist({
      kind: "user",
      targetId: "261",
      label: "Shedletsky",
      imageUrl: null,
    });
    const again = await backend.addToWatchlist({
      kind: "user",
      targetId: "261",
      label: "New label",
      imageUrl: "https://tr.rbxcdn.com/x",
    });

    expect(again.id).toBe(first.id);
    expect(again.label).toBe("New label");
    expect(await backend.listWatchlist()).toHaveLength(1);
  });

  it("rejects unknown kinds and non-numeric targets", async () => {
    await expect(
      backend.addToWatchlist({
        // @ts-expect-error deliberately invalid kind
        kind: "clan",
        targetId: "261",
        label: "x",
        imageUrl: null,
      }),
    ).rejects.toBeInstanceOf(BackendError);
    await expect(
      backend.addToWatchlist({
        kind: "user",
        targetId: "261 OR 1=1",
        label: "x",
        imageUrl: null,
      }),
    ).rejects.toBeInstanceOf(BackendError);
  });

  it("errors when removing something that is not on the list", async () => {
    await expect(backend.removeFromWatchlist("nope")).rejects.toBeInstanceOf(
      BackendError,
    );
  });
});

describe("linking a Roblox profile", () => {
  it("only accepts a numeric user ID", async () => {
    await expect(
      backend.saveSettings({ robloxUserId: "not-an-id" }),
    ).rejects.toBeInstanceOf(BackendError);

    const settings = await backend.saveSettings({
      robloxUserId: "261",
      robloxUsername: "Shedletsky",
    });
    expect(settings.robloxUserId).toBe("261");
  });
});

describe("rejoining a specific server", () => {
  it("builds the protocol URL with the instance and refuses a fake one", async () => {
    const receipt = await backend.launchRoblox({
      placeId: "920587237",
      gameId: null,
      accountProfileId: null,
      gameInstanceId: "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0",
    });
    expect(receipt.uri).toBe(
      "roblox://placeId=920587237&gameInstanceId=0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0",
    );

    await expect(
      backend.launchRoblox({
        placeId: "920587237",
        gameId: null,
        accountProfileId: null,
        gameInstanceId: "not-a-uuid",
      }),
    ).rejects.toThrow();
  });
});

describe("helpers shared with the Rust repository", () => {
  it("derives initials the same way", () => {
    expect(initialsFor("Sebi Zupanc", "")).toBe("SZ");
    expect(initialsFor("SebiMain", "Main")).toBe("SE");
    expect(initialsFor("", "Zweitkonto")).toBe("ZW");
  });

  it("normalizes tags the same way", () => {
    expect(normalizeTags(["  Obby ", "OBBY", "", "Horror"])).toEqual([
      "obby",
      "horror",
    ]);
  });
});
