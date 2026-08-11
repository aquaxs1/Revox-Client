import { Plus, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { GameSummary } from "../contracts/entities";
import { parsePlaceId } from "../domain/roblox";
import { useI18n } from "../i18n";
import { toBackendError } from "../services/backend";
import { useAppStore } from "../state/AppStore";
import { Dialog } from "./Dialog";

/**
 * Adds a game by name, Place ID or official Roblox link.
 *
 * A Place ID or link resolves immediately — that path never depends on Roblox's
 * search endpoint. Anything else is treated as a name and searched, so the
 * common case is "type Doors, click the right one" rather than hunting for an
 * ID first.
 */
export function AddGameDialog({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (message: string, tone: "success" | "error") => void;
}) {
  const { t, translateError } = useI18n();
  const { backend, addGame } = useAppStore();
  const [reference, setReference] = useState("");
  const [results, setResults] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function store(placeId: string) {
    setBusy(true);
    setError(null);
    try {
      const { game, metadataFailed } = await addGame(placeId);
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

  async function submit(event: FormEvent) {
    event.preventDefault();

    const placeId = parsePlaceId(reference);
    if (placeId) {
      await store(placeId);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      setResults(await backend.searchGames(reference));
    } catch (reason) {
      const failure = toBackendError(reason);
      setError(translateError(failure.code, failure.message));
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title={t("saved.addGame")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--rv-gap-sm)" }}>
        <div className="rv-field">
          <label htmlFor="rv-reference">{t("saved.searchOrPaste")}</label>
          <input
            id="rv-reference"
            className="rv-input"
            value={reference}
            onChange={(event) => {
              setReference(event.target.value);
              setResults(null);
            }}
            placeholder="Doors"
            autoFocus
            required
          />
          <small>{t("saved.referenceHint")}</small>
        </div>

        {busy && <p style={{ margin: 0, fontSize: 12 }}>{t("saved.fetching")}</p>}
        {error && <p className="rv-error-text">{error}</p>}

        {results !== null && results.length === 0 && !busy && (
          <p style={{ margin: 0, color: "var(--rv-text-muted)", fontSize: 12 }}>
            {t("explore.noResults")}
          </p>
        )}

        {results && results.length > 0 && (
          <>
            <p style={{ margin: 0, color: "var(--rv-text-muted)", fontSize: 12 }}>
              {t("saved.pickResult")}
            </p>
            <div className="rv-result-grid" style={{ gridTemplateColumns: "1fr" }}>
              {results.slice(0, 8).map((game) => (
                <button
                  key={game.universeId}
                  type="button"
                  className="rv-result"
                  disabled={busy || !game.rootPlaceId}
                  onClick={() => void store(game.rootPlaceId)}
                >
                  <img
                    className="rv-result-thumb"
                    src={game.iconUrl ?? undefined}
                    alt=""
                    aria-hidden
                  />
                  <span className="rv-result-body">
                    <strong>{game.name}</strong>
                    <small>{game.creatorName}</small>
                  </span>
                  <Plus size={16} aria-hidden />
                </button>
              ))}
            </div>
          </>
        )}

        <div className="rv-dialog-actions">
          <button type="button" className="rv-button is-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="rv-button is-primary" disabled={busy}>
            <Search size={15} />
            {parsePlaceId(reference) ? t("common.add") : t("common.search")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
