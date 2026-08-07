import { useEffect, useState } from "react";
import { AppShell, type PageId } from "./components/AppShell";
import { LaunchDialog } from "./components/LaunchDialog";
import { Toast } from "./components/Toast";
import { Accounts } from "./pages/Accounts";
import { Dashboard } from "./pages/Dashboard";
import { LibraryPage } from "./pages/Library";
import { Performance } from "./pages/Performance";
import { SettingsPage } from "./pages/Settings";
import { Stats } from "./pages/Stats";
import { launchRoblox } from "./services/launcher";
import { AppStoreProvider, useAppStore } from "./state/AppStore";
import "./styles/tokens.css";
import "./styles/app.css";

function Experience() {
  const { state, recordLaunch } = useAppStore();
  const [activePage, setActivePage] = useState<PageId>("dashboard");
  const [launchGameId, setLaunchGameId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const game = state.games.find((entry) => entry.id === launchGameId);
  const account = state.accounts.find(
    (entry) => entry.id === state.selectedAccountId,
  )!;

  useEffect(() => {
    document.documentElement.dataset.theme = state.appearance.theme;
    document.documentElement.dataset.accent = state.appearance.accent;
    document.documentElement.dataset.font = state.appearance.font;
    document.documentElement.dataset.density = state.appearance.density;
  }, [state.appearance]);

  async function confirmLaunch() {
    if (!game) return;
    try {
      const result = await launchRoblox(game.placeId);
      recordLaunch(game.id, true);
      setToast(
        result.mode === "preview"
          ? `Vorschau: ${game.title} würde jetzt offiziell geöffnet.`
          : `${game.title} wurde an Roblox übergeben.`,
      );
    } catch (error) {
      recordLaunch(game.id, false);
      setToast(error instanceof Error ? error.message : "Roblox konnte nicht geöffnet werden.");
    } finally {
      setLaunchGameId(null);
    }
  }

  let page;
  switch (activePage) {
    case "library":
      page = <LibraryPage onLaunch={setLaunchGameId} />;
      break;
    case "accounts":
      page = <Accounts />;
      break;
    case "performance":
      page = <Performance />;
      break;
    case "stats":
      page = <Stats />;
      break;
    case "settings":
      page = <SettingsPage />;
      break;
    default:
      page = <Dashboard onLaunch={setLaunchGameId} onNavigate={setActivePage} />;
  }

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
      {page}
      {game && (
        <LaunchDialog
          game={game}
          account={account}
          onClose={() => setLaunchGameId(null)}
          onConfirm={confirmLaunch}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </AppShell>
  );
}

export default function App() {
  return (
    <AppStoreProvider>
      <Experience />
    </AppStoreProvider>
  );
}
