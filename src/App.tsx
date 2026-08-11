import { useCallback, useEffect, useState } from "react";
import { AppShell, type PageId } from "./components/AppShell";
import { AddGameDialog } from "./components/AddGameDialog";
import { LaunchDialog } from "./components/LaunchDialog";
import { Onboarding } from "./components/Onboarding";
import { Toast, type ToastMessage } from "./components/Toast";
import type { Game } from "./contracts/entities";
import { I18nProvider, useI18n } from "./i18n";
import { ExitPage } from "./pages/Exit";
import { ExplorePage } from "./pages/Explore";
import { FriendsPage } from "./pages/Friends";
import { PlayPage } from "./pages/Play";
import { ProfilePage } from "./pages/Profile";
import { SavedPage } from "./pages/Saved";
import { SettingsPage } from "./pages/Settings";
import { StatsPage } from "./pages/Stats";
import { isTauri, toBackendError } from "./services/backend";
import { AppStoreProvider, useAppStore, useSelectedAccount } from "./state/AppStore";
import type { BackendPort } from "./contracts/commands";

/** Event the Rust session monitor emits after it writes a session. */
const SESSION_EVENT = "revox://session-changed";

/** Resolves the `system` theme to a concrete one and keeps it in sync. */
function useResolvedTheme(theme: string) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function apply() {
      const resolved =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
    }

    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}

function Workspace() {
  const { t, translateError } = useI18n();
  const { state, launch, launchPlace, reload, refreshRobloxStatus } = useAppStore();
  const account = useSelectedAccount();
  const [page, setPage] = useState<PageId>("play");
  const [pendingLaunch, setPendingLaunch] = useState<Game | null>(null);
  const [addingGame, setAddingGame] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const { theme, accent, spacing } = state.settings;
  useResolvedTheme(theme);

  useEffect(() => {
    document.documentElement.style.setProperty("--rv-accent", accent);
    document.documentElement.dataset.spacing = spacing;
  }, [accent, spacing]);

  // Probe Roblox on start and then on a slow cadence, so the status chip and
  // the exit warning reflect reality without hammering the OS.
  useEffect(() => {
    void refreshRobloxStatus();
    const timer = window.setInterval(() => void refreshRobloxStatus(), 15_000);
    return () => window.clearInterval(timer);
  }, [refreshRobloxStatus]);

  // The Rust monitor writes sessions on its own schedule; this pulls the new
  // rows in so the stats screen updates without a restart.
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen(SESSION_EVENT, () => void reload());
    })();
    return () => unlisten?.();
  }, [reload]);

  const confirmLaunch = useCallback(async () => {
    if (!pendingLaunch) return;
    try {
      await launch(pendingLaunch);
      setToast({
        tone: "success",
        text: isTauri()
          ? t("launch.success", { name: pendingLaunch.name })
          : t("launch.preview", { name: pendingLaunch.name }),
      });
    } catch (reason) {
      const failure = toBackendError(reason);
      setToast({
        tone: "error",
        text: translateError(failure.code, failure.message),
      });
    } finally {
      setPendingLaunch(null);
    }
  }, [launch, pendingLaunch, t, translateError]);

  /** Re-enters a place directly, bypassing the confirmation dialog. */
  const rejoin = useCallback(
    async (placeId: string, gameInstanceId: string | null) => {
      try {
        await launchPlace(placeId, gameInstanceId);
        setToast({
          tone: "success",
          text: isTauri()
            ? t("launch.success", { name: placeId })
            : t("launch.preview", { name: placeId }),
        });
      } catch (reason) {
        const failure = toBackendError(reason);
        setToast({
          tone: "error",
          text: translateError(failure.code, failure.message),
        });
      }
    },
    [launchPlace, t, translateError],
  );

  if (state.status === "loading") {
    return <div className="rv-loading">{t("common.loading")}</div>;
  }

  if (state.status === "error") {
    return (
      <div className="rv-loading">
        <div className="rv-empty">
          <strong>{translateError(state.errorCode ?? "UNEXPECTED")}</strong>
          <button className="rv-button is-primary" onClick={() => void reload()}>
            {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (!state.settings.onboardingComplete) {
    return <Onboarding />;
  }

  let content;
  switch (page) {
    case "profile":
      content = <ProfilePage onLaunch={setPendingLaunch} />;
      break;
    case "saved":
      content = (
        <SavedPage
          onLaunch={setPendingLaunch}
          onAddGame={() => setAddingGame(true)}
        />
      );
      break;
    case "stats":
      content = <StatsPage />;
      break;
    case "explore":
      content = (
        <ExplorePage onToast={(text, tone) => setToast({ text, tone })} />
      );
      break;
    case "friends":
      content = <FriendsPage onOpenSettings={() => setPage("settings")} />;
      break;
    case "settings":
      content = <SettingsPage />;
      break;
    case "exit":
      content = <ExitPage onCancel={() => setPage("play")} />;
      break;
    default:
      content = (
        <PlayPage
          onLaunch={setPendingLaunch}
          onAddGame={() => setAddingGame(true)}
          onRejoin={(placeId, instanceId) => void rejoin(placeId, instanceId)}
          onOpenSettings={() => setPage("settings")}
        />
      );
  }

  return (
    <AppShell activePage={page} onNavigate={setPage}>
      {content}

      {pendingLaunch && (
        <LaunchDialog
          game={pendingLaunch}
          account={account}
          onClose={() => setPendingLaunch(null)}
          onConfirm={confirmLaunch}
        />
      )}

      {addingGame && (
        <AddGameDialog
          onClose={() => setAddingGame(false)}
          onAdded={(text, tone) => setToast({ text, tone })}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </AppShell>
  );
}

function Localized() {
  const { state } = useAppStore();
  return (
    <I18nProvider locale={state.settings.locale}>
      <Workspace />
    </I18nProvider>
  );
}

export default function App({ backend }: { backend: BackendPort }) {
  return (
    <AppStoreProvider backend={backend}>
      <Localized />
    </AppStoreProvider>
  );
}
