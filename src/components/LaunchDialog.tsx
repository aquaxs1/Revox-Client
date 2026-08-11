import { ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { AccountProfile, Game } from "../contracts/entities";
import { useI18n } from "../i18n";
import { Dialog } from "./Dialog";

/**
 * The confirmation shown before a Place ID is handed to Roblox.
 *
 * It names the game, the Place ID and the local profile so a launch always
 * happens under the profile the user actually meant.
 */
export function LaunchDialog({
  game,
  account,
  onClose,
  onConfirm,
}: {
  game: Game;
  account: AccountProfile | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [launching, setLaunching] = useState(false);

  async function confirm() {
    setLaunching(true);
    try {
      await onConfirm();
    } finally {
      setLaunching(false);
    }
  }

  return (
    <Dialog title={t("launch.title")} onClose={onClose}>
      <p style={{ margin: 0, fontWeight: 600 }}>{game.name}</p>

      <div className="rv-dialog-facts">
        <div>
          <span className="rv-fact-label">{t("launch.placeId")}</span>
          <strong style={{ display: "block" }}>{game.placeId}</strong>
        </div>
        <div>
          <span className="rv-fact-label">{t("launch.profile")}</span>
          <strong style={{ display: "block" }}>
            {account?.username ?? t("launch.profileNone")}
          </strong>
        </div>
        <div>
          <span className="rv-fact-label">{t("launch.handover")}</span>
          <strong style={{ display: "block" }}>{t("launch.handoverValue")}</strong>
        </div>
      </div>

      <div className="rv-note">
        <ShieldCheck size={18} aria-hidden />
        <span>{t("launch.note")}</span>
      </div>

      <div className="rv-dialog-actions">
        <button className="rv-button is-ghost" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button className="rv-button is-play" onClick={confirm} disabled={launching}>
          <ExternalLink size={16} />
          {launching ? t("launch.launching") : t("launch.confirm")}
        </button>
      </div>
    </Dialog>
  );
}
