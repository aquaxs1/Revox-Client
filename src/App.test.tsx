import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("Rift Companion", () => {
  it("opens on the launch dashboard and navigates to the library", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Bereit zum Spielen" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Bibliothek" }));
    expect(
      screen.getByRole("heading", { name: "Deine Spiele" }),
    ).toBeVisible();
  });

  it("shows a confirmation before launching the selected game", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "DOORS starten" }));
    expect(
      screen.getByRole("heading", { name: "Offiziell mit Roblox öffnen?" }),
    ).toBeVisible();
    expect(screen.getByText("Keine Passwörter oder Cookies")).toBeVisible();
  });

  it("switches the local account profile", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Konten" }));
    await user.click(screen.getByRole("button", { name: "SebiAlt auswählen" }));
    expect(screen.getByText("Als lokales Profil aktiv")).toBeVisible();
  });

  it("switches to the performance profile", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Performance" }));
    await user.click(
      screen.getByRole("button", { name: "Performance-Profil aktivieren" }),
    );
    expect(screen.getByText("Aktives Profil: Performance")).toBeVisible();
  });
});
