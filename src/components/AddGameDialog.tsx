import { useState, type FormEvent } from "react";
import { useI18n } from "../i18n";
import { toBackendError } from "../services/backend";
import { useAppStore } from "../state/AppStore";
import { Dialog } from "./Dialog";

/**
 * Adds a game from a Place ID or an official Roblox link.
 *
 * The name and cover come from the public Roblox catalog; when that lookup
 * fails the game is still saved with a placeholder name and the user is told.
 */
export function AddGameDialog({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (message: string, tone: "success" | "error") => void;
}) {
  const { t, translateError } = useI18n();
  const { addGame } = useAppStore();
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { game, metadataFailed } = await addGame(reference);
      onAdded(
        metadataFailed ? t("saved.fetchFailed") : game.name,
        metadataFailed ? "error" : "success",
      );
      onClose();
    } catch (reason) {
      const failure = toBackendError(reason);
      setError(
        failure.code === "INVALID_PLACE_ID"
          ? t("saved.invalidReference")
          : translateError(failure.code, failure.message),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title={t("saved.addGame")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--rv-gap-sm)" }}>
        <div className="rv-field">
          <label htmlFor="rv-reference">{t("saved.reference")}</label>
          <input
            id="rv-reference"
            className="rv-input"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="920587237"
            autoFocus
            required
          />
          <small>{t("saved.referenceHint")}</small>
        </div>

        {busy && <p style={{ margin: 0, fontSize: 12 }}>{t("saved.fetching")}</p>}
        {error && <p className="rv-error-text">{error}</p>}

        <div className="rv-dialog-actions">
          <button type="button" className="rv-button is-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="rv-button is-primary" disabled={busy}>
            {t("common.add")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
