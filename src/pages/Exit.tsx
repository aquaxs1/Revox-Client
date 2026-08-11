import { AlertTriangle, LogOut, Minus } from "lucide-react";
import { useI18n } from "../i18n";
import { closeWindow, minimizeWindow } from "../services/window";
import { isTauri } from "../services/backend";
import { useAppStore } from "../state/AppStore";
import { Logo } from "../components/Logo";

/**
 * The exit screen behind the last rail icon.
 *
 * Closing Revox never touches a running Roblox process — the warning says so
 * explicitly, because the only consequence is that the session stops being
 * recorded.
 */
export function ExitPage({ onCancel }: { onCancel: () => void }) {
  const { t } = useI18n();
  const { state } = useAppStore();

  const sessionRunning = state.robloxStatus?.state === "running";

  return (
    <div className="rv-exit">
      <Logo size={72} title={t("app.name")} />
      <h2>{t("exit.question")}</h2>
      <p>{t("exit.body")}</p>

      {sessionRunning && (
        <p className="rv-warning">
          <AlertTriangle size={16} aria-hidden />
          {t("exit.sessionRunning")}
        </p>
      )}

      <div className="rv-exit-actions">
        <button className="rv-button is-ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        {isTauri() && (
          <button className="rv-button" onClick={() => void minimizeWindow()}>
            <Minus size={16} />
            {t("exit.minimize")}
          </button>
        )}
        <button
          className="rv-button is-danger"
          onClick={() => void closeWindow()}
          disabled={!isTauri()}
          title={isTauri() ? undefined : t("common.notAvailable")}
        >
          <LogOut size={16} />
          {t("exit.confirm")}
        </button>
      </div>
    </div>
  );
}
