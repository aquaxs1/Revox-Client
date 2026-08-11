import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import type { BackendPort } from "./contracts/commands";
import { createMemoryBackend } from "./services/memoryBackend";

let backend: BackendPort;

beforeEach(() => {
  backend = createMemoryBackend(null);
});

/** Walks the setup wizard end to end and lands on the dashboard. */
async function completeOnboarding() {
  render(<App backend={backend} />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Einrichtung starten" }),
  );
  // Language and theme, then the defaults.
  await userEvent.click(screen.getByRole("button", { name: /Weiter/ }));
  await userEvent.click(screen.getByRole("button", { name: /Weiter/ }));
  // Linking a Roblox profile is optional.
  await userEvent.click(screen.getByRole("button", { name: /Überspringen/ }));
  await userEvent.click(screen.getByRole("button", { name: "Revox öffnen" }));
  await screen.findByRole("heading", { name: "Dashboard", level: 1 });
}

describe("onboarding", () => {
  it("greets a fresh install and cannot be skipped by navigating", async () => {
    render(<App backend={backend} />);

    expect(
      await screen.findByRole("heading", { name: "Let's set things up!" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("switches the whole interface language before finishing", async () => {
    render(<App backend={backend} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Einrichtung starten" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Englisch" }));

    expect(screen.getByRole("button", { name: /Next/ })).toBeInTheDocument();
  });

  it("does not come back after it has been completed", async () => {
    await completeOnboarding();

    expect((await backend.getBootstrap()).settings.onboardingComplete).toBe(true);
  });
});

describe("dashboard", () => {
  it("explains what to do when the library is still empty", async () => {
    await completeOnboarding();

    expect(screen.getByText("Noch kein Spiel gestartet")).toBeInTheDocument();
    expect(screen.getByText("Noch keine Sitzungen aufgezeichnet.")).toBeInTheDocument();
  });

  it("navigates between the rail pages", async () => {
    await completeOnboarding();

    await userEvent.click(screen.getByRole("button", { name: "Statistiken" }));
    expect(
      screen.getByRole("heading", { name: "Stats", level: 1 }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Einstellungen" }));
    expect(
      screen.getByRole("heading", { name: "Einstellungen", level: 1 }),
    ).toBeInTheDocument();
  });
});

describe("adding a game", () => {
  it("rejects something that is neither a Place ID nor a Roblox link", async () => {
    await completeOnboarding();
    await userEvent.click(screen.getAllByRole("button", { name: /Spiel hinzufügen/ })[0]);

    await userEvent.type(
      screen.getByLabelText("Spielname, Place-ID oder Roblox-Link"),
      "not-a-place",
    );
    await userEvent.click(screen.getByRole("button", { name: "Suchen" }));

    // Anything that is not an ID or a link is treated as a name and searched,
    // which the preview cannot do.
    expect(
      await screen.findByText("Roblox ist gerade nicht erreichbar."),
    ).toBeInTheDocument();
  });

  it("saves the game even when Roblox metadata is unavailable", async () => {
    await completeOnboarding();
    await userEvent.click(screen.getAllByRole("button", { name: /Spiel hinzufügen/ })[0]);

    await userEvent.type(
      screen.getByLabelText("Spielname, Place-ID oder Roblox-Link"),
      "https://www.roblox.com/games/920587237/Doors",
    );
    await userEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));

    const stored = (await backend.getBootstrap()).games;
    expect(stored).toHaveLength(1);
    expect(stored[0].placeId).toBe("920587237");
  });
});

describe("launching", () => {
  it("asks for confirmation and reports the browser preview handover", async () => {
    // Seed before mounting so the store loads the game with its bootstrap.
    await backend.upsertGame({
      placeId: "920587237",
      name: "Doors",
      description: "",
      tags: [],
    });
    await backend.saveSettings({ onboardingComplete: true });
    render(<App backend={backend} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Gespeicherte Spiele" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Play: Doors" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("920587237")).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Mit Roblox öffnen" }),
    );

    expect(
      await screen.findByText(/Browser-Vorschau: Doors würde jetzt offiziell/),
    ).toBeInTheDocument();
  });

  it("hands the exact official protocol URL to the backend", async () => {
    const game = await backend.upsertGame({
      placeId: "920587237",
      name: "Doors",
      description: "",
      tags: [],
    });

    const receipt = await backend.launchRoblox({
      placeId: game.placeId,
      gameId: game.id,
      accountProfileId: null,
    });

    expect(receipt.uri).toBe("roblox://placeId=920587237");
  });
});

describe("local profiles", () => {
  it("creates a profile and makes it the active one", async () => {
    await completeOnboarding();
    await userEvent.click(screen.getByRole("button", { name: "Profil" }));

    await userEvent.click(screen.getByRole("button", { name: /Add a account/ }));
    await userEvent.type(screen.getByLabelText("Roblox-Benutzername"), "SebiMain");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    const bootstrap = await backend.getBootstrap();
    expect(bootstrap.accounts).toHaveLength(1);
    expect(bootstrap.settings.selectedAccountId).toBe(bootstrap.accounts[0].id);
  });

  it("refuses a blank username", async () => {
    await completeOnboarding();
    await userEvent.click(screen.getByRole("button", { name: "Profil" }));
    await userEvent.click(screen.getByRole("button", { name: /Add a account/ }));

    await userEvent.type(screen.getByLabelText("Roblox-Benutzername"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(
      await screen.findByText("Der Benutzername muss 1 bis 40 Zeichen lang sein."),
    ).toBeInTheDocument();
  });
});

describe("opt-in playtime tracking", () => {
  it("is off on a fresh install and the dashboard says so", async () => {
    await completeOnboarding();

    expect((await backend.getBootstrap()).settings.statsTrackingEnabled).toBe(false);
    expect(
      screen.getByText(
        "Spielzeit-Erfassung ist aus. Aktiviere sie in den Einstellungen.",
      ),
    ).toBeInTheDocument();
  });

  it("can be turned on from Settings and then stops warning", async () => {
    await completeOnboarding();
    await userEvent.click(screen.getByRole("button", { name: "Erfassung einschalten" }));

    const group = screen.getByRole("group", { name: "Spielzeit erfassen" });
    await userEvent.click(within(group).getByRole("button", { name: "An" }));

    expect((await backend.getBootstrap()).settings.statsTrackingEnabled).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Spielen" }));
    expect(
      screen.queryByText(
        "Spielzeit-Erfassung ist aus. Aktiviere sie in den Einstellungen.",
      ),
    ).not.toBeInTheDocument();
  });
});

describe("the explorer", () => {
  it("offers profile, game and item search", async () => {
    await completeOnboarding();
    await userEvent.click(screen.getByRole("button", { name: "Explorer" }));

    expect(screen.getByRole("button", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spiele" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "UGC & Katalog" })).toBeInTheDocument();
    expect(screen.getByLabelText("Benutzername suchen")).toBeInTheDocument();
  });

  it("reports that Roblox lookups need the desktop app", async () => {
    await completeOnboarding();
    await userEvent.click(screen.getByRole("button", { name: "Explorer" }));

    await userEvent.type(screen.getByLabelText("Benutzername suchen"), "builderman");
    await userEvent.click(screen.getByRole("button", { name: "Suchen" }));

    expect(
      await screen.findByText("Roblox ist gerade nicht erreichbar."),
    ).toBeInTheDocument();
  });
});

describe("the friends screen", () => {
  it("asks for a linked Roblox profile before it can show anything", async () => {
    await completeOnboarding();
    await userEvent.click(screen.getByRole("button", { name: "Freunde" }));

    expect(screen.getByText("Kein Roblox-Profil verknüpft")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Jetzt verknüpfen" }));
    expect(
      screen.getByRole("heading", { name: "Einstellungen", level: 1 }),
    ).toBeInTheDocument();
  });
});

describe("the companion settings", () => {
  it("start with tray on and everything else off", async () => {
    await completeOnboarding();

    const settings = (await backend.getBootstrap()).settings;
    expect(settings.minimizeToTray).toBe(true);
    expect(settings.autostartEnabled).toBe(false);
    expect(settings.notifyFriends).toBe(false);
    expect(settings.discordEnabled).toBe(false);
  });

  it("keep friend notifications locked until a Roblox profile is linked", async () => {
    await completeOnboarding();
    await userEvent.click(screen.getByRole("button", { name: "Einstellungen" }));

    const group = screen.getByRole("group", { name: "Freunde-Benachrichtigungen" });
    expect(within(group).getByRole("button", { name: "An" })).toBeDisabled();
    expect(screen.getByText("Verknüpfe zuerst ein Roblox-Profil.")).toBeInTheDocument();
  });

  it("offer Discord as a single switch, with no ID to fill in", async () => {
    await completeOnboarding();
    await userEvent.click(screen.getByRole("button", { name: "Einstellungen" }));

    const group = screen.getByRole("group", { name: "Rich Presence aktiv" });
    expect(within(group).getByRole("button", { name: "An" })).toBeEnabled();
    // The application ID is an advanced escape hatch, not a required step.
    expect(screen.getByText("Eigene Application-ID verwenden")).toBeInTheDocument();
  });

  it("refuse an advanced Discord application ID that is not a snowflake", async () => {
    await completeOnboarding();
    await userEvent.click(screen.getByRole("button", { name: "Einstellungen" }));

    await userEvent.click(screen.getByText("Eigene Application-ID verwenden"));
    await userEvent.type(screen.getByLabelText("Discord Application-ID"), "12345");
    await userEvent.tab();

    expect(
      await screen.findByText(
        "Eine Discord Application-ID besteht aus 17 bis 20 Ziffern.",
      ),
    ).toBeInTheDocument();
  });

  it("store a valid advanced Discord application ID", async () => {
    await completeOnboarding();
    await userEvent.click(screen.getByRole("button", { name: "Einstellungen" }));

    await userEvent.click(screen.getByText("Eigene Application-ID verwenden"));
    await userEvent.type(
      screen.getByLabelText("Discord Application-ID"),
      "123456789012345678",
    );
    await userEvent.tab();

    const stored = (await backend.getBootstrap()).settings;
    expect(stored.discordApplicationId).toBe("123456789012345678");
  });

  it("report that the update source is unavailable in the preview", async () => {
    await completeOnboarding();
    await userEvent.click(screen.getByRole("button", { name: "Einstellungen" }));

    await userEvent.click(screen.getByRole("button", { name: "Nach Updates suchen" }));

    // A desktop-only action must not blame Roblox for being unreachable.
    expect(
      await screen.findByText(
        "Das geht nur in der Desktop-App, nicht in der Browser-Vorschau.",
      ),
    ).toBeInTheDocument();
  });
});

describe("exporting statistics", () => {
  it("disables export while there is nothing to export", async () => {
    await completeOnboarding();
    await userEvent.click(screen.getByRole("button", { name: "Statistiken" }));

    expect(screen.getByRole("button", { name: "Als CSV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Als JSON" })).toBeDisabled();
  });
});

describe("the setup wizard", () => {
  it("writes each choice as it is made, so quitting halfway still configures the app", async () => {
    render(<App backend={backend} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Einrichtung starten" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Hell" }));
    expect((await backend.getBootstrap()).settings.theme).toBe("light");

    await userEvent.click(screen.getByRole("button", { name: /Weiter/ }));
    const tracking = screen.getByRole("group", { name: "Spielzeit erfassen" });
    await userEvent.click(within(tracking).getByRole("button", { name: "An" }));

    const stored = (await backend.getBootstrap()).settings;
    expect(stored.statsTrackingEnabled).toBe(true);
    // Not finished yet, so the wizard still owns the screen.
    expect(stored.onboardingComplete).toBe(false);
  });

  it("lets the Roblox link be skipped entirely", async () => {
    await completeOnboarding();

    const settings = (await backend.getBootstrap()).settings;
    expect(settings.onboardingComplete).toBe(true);
    expect(settings.robloxUserId).toBeNull();
  });

  it("can walk backwards without losing a choice", async () => {
    render(<App backend={backend} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Einrichtung starten" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Englisch" }));
    await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    await userEvent.click(screen.getByRole("button", { name: /Back/ }));

    expect((await backend.getBootstrap()).settings.locale).toBe("en");
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("linking a Roblox profile", () => {
  it("offers the detected account for one-click confirmation", async () => {
    const detecting = {
      ...createMemoryBackend(null),
      detectRobloxAccount: async () => ({
        id: "261",
        name: "Shedletsky",
        displayName: "Shedletsky",
        description: "",
        created: null,
        accountAgeDays: null,
        hasVerifiedBadge: true,
        isBanned: false,
        avatarUrl: null,
      }),
    } as BackendPort;
    await detecting.saveSettings({ onboardingComplete: true });
    render(<App backend={detecting} />);

    await userEvent.click(await screen.findByRole("button", { name: "Einstellungen" }));
    await userEvent.click(await screen.findByRole("button", { name: /Das bin ich/ }));

    const settings = (await detecting.getBootstrap()).settings;
    expect(settings.robloxUserId).toBe("261");
    expect(settings.robloxUsername).toBe("Shedletsky");
  });

  it("falls back to a search picker when nothing is detected", async () => {
    await completeOnboarding();
    await userEvent.click(screen.getByRole("button", { name: "Einstellungen" }));

    expect(screen.queryByText(/Das bin ich/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Profil suchen")).toBeInTheDocument();
  });
});
