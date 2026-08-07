import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppStoreProvider, useAppStore } from "./AppStore";

function StoreProbe() {
  const {
    state,
    toggleFavorite,
    addGame,
    selectAccount,
    updateAppearance,
    recordLaunch,
  } = useAppStore();
  const firstGame = state.games[0];

  return (
    <div>
      <output data-testid="favorite-state">
        {String(firstGame.favorite)}
      </output>
      <output data-testid="game-count">{state.games.length}</output>
      <output data-testid="account">{state.selectedAccountId}</output>
      <output data-testid="theme">{state.appearance.theme}</output>
      <output data-testid="activity-count">{state.activity.length}</output>
      <button onClick={() => toggleFavorite(firstGame.id)}>
        Favorit umschalten
      </button>
      <button
        onClick={() =>
          addGame("https://www.roblox.com/games/1234567890/Mein-Spiel")
        }
      >
        Spiel hinzufügen
      </button>
      <button onClick={() => selectAccount("alt")}>Konto auswählen</button>
      <button onClick={() => updateAppearance({ theme: "light" })}>
        Theme ändern
      </button>
      <button onClick={() => recordLaunch(firstGame.id, true)}>
        Start erfassen
      </button>
    </div>
  );
}

describe("AppStore", () => {
  it("toggles a game favorite", async () => {
    const user = userEvent.setup();
    render(
      <AppStoreProvider>
        <StoreProbe />
      </AppStoreProvider>,
    );

    const initial = screen.getByTestId("favorite-state").textContent;
    await user.click(screen.getByRole("button", { name: "Favorit umschalten" }));

    expect(screen.getByTestId("favorite-state")).toHaveTextContent(
      initial === "true" ? "false" : "true",
    );
  });

  it("adds a valid Roblox game once", async () => {
    const user = userEvent.setup();
    render(
      <AppStoreProvider>
        <StoreProbe />
      </AppStoreProvider>,
    );

    const initial = Number(screen.getByTestId("game-count").textContent);
    await user.click(screen.getByRole("button", { name: "Spiel hinzufügen" }));
    await user.click(screen.getByRole("button", { name: "Spiel hinzufügen" }));

    expect(screen.getByTestId("game-count")).toHaveTextContent(
      String(initial + 1),
    );
  });

  it("updates profile, appearance, and launch activity", async () => {
    const user = userEvent.setup();
    render(
      <AppStoreProvider>
        <StoreProbe />
      </AppStoreProvider>,
    );

    const initialActivity = Number(
      screen.getByTestId("activity-count").textContent,
    );
    await user.click(screen.getByRole("button", { name: "Konto auswählen" }));
    await user.click(screen.getByRole("button", { name: "Theme ändern" }));
    await user.click(screen.getByRole("button", { name: "Start erfassen" }));

    expect(screen.getByTestId("account")).toHaveTextContent("alt");
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(screen.getByTestId("activity-count")).toHaveTextContent(
      String(initialActivity + 1),
    );
  });
});
