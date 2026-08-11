import { BadgeCheck, Check, Search, UserCheck } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { RobloxUser } from "../contracts/entities";
import { displayNameOf } from "../domain/roblox-stats";
import { useI18n } from "../i18n";
import { toBackendError } from "../services/backend";
import { useAppStore } from "../state/AppStore";

/**
 * Links a public Roblox profile in as few steps as possible.
 *
 * First it asks the machine: Roblox writes the signed-in user ID into its own
 * local logs, so in the common case this is a single "yes, that's me". When
 * there is nothing to detect, a search picker with avatars takes over — still
 * no exact spelling required, because you pick a face rather than type a name.
 */
export function RobloxAccountLink({ compact = false }: { compact?: boolean }) {
  const { t, translateError } = useI18n();
  const { state, backend, saveSettings, unlinkRobloxAccount } = useAppStore();

  const [suggestion, setSuggestion] = useState<RobloxUser | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RobloxUser[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linked = state.settings.robloxUserId;

  // Ask once, on mount, and only while nothing is linked yet.
  useEffect(() => {
    if (linked) return;
    let cancelled = false;
    void (async () => {
      try {
        const found = await backend.detectRobloxAccount();
        if (!cancelled) setSuggestion(found);
      } catch {
        // Detection is a convenience; the search path always remains.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backend, linked]);

  const link = useCallback(
    async (user: RobloxUser) => {
      setBusy(true);
      setError(null);
      try {
        await saveSettings({ robloxUserId: user.id, robloxUsername: user.name });
      } catch (reason) {
        const failure = toBackendError(reason);
        setError(translateError(failure.code, failure.message));
      } finally {
        setBusy(false);
      }
    },
    [saveSettings, translateError],
  );

  async function search(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResults(await backend.searchUsers(query));
    } catch (reason) {
      const failure = toBackendError(reason);
      setError(translateError(failure.code, failure.message));
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  if (linked) {
    return (
      <div className="rv-setting-row">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <UserCheck size={18} aria-hidden />
          <strong>
            {t("settings.robloxAccount.linked", {
              name: state.settings.robloxUsername ?? "?",
              id: linked,
            })}
          </strong>
        </div>
        <button className="rv-button" onClick={() => void unlinkRobloxAccount()}>
          {t("settings.robloxAccount.unlink")}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--rv-gap-sm)" }}>
      {suggestion && (
        <div className="rv-suggestion">
          <img
            className="rv-result-avatar"
            src={suggestion.avatarUrl ?? undefined}
            alt=""
            aria-hidden
          />
          <div className="rv-result-body">
            <small>{t("settings.robloxAccount.detected")}</small>
            <strong>
              {displayNameOf(suggestion)}
              {suggestion.hasVerifiedBadge && <BadgeCheck size={14} aria-hidden />}
            </strong>
            <small>@{suggestion.name}</small>
          </div>
          <button
            className="rv-button is-primary"
            disabled={busy}
            onClick={() => void link(suggestion)}
          >
            <Check size={15} />
            {t("settings.robloxAccount.thatsMe")}
          </button>
        </div>
      )}

      <form className="rv-setting-row" onSubmit={search} style={{ borderTop: 0 }}>
        <div className="rv-field" style={{ flex: 1, minWidth: 220 }}>
          <label htmlFor="rv-roblox-search">
            {suggestion
              ? t("settings.robloxAccount.searchOther")
              : t("settings.robloxAccount.search")}
          </label>
          <input
            id="rv-roblox-search"
            className="rv-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Builderman"
            required
          />
          {!compact && <small>{t("settings.robloxAccount.searchHint")}</small>}
        </div>
        <button className="rv-button" type="submit" disabled={busy}>
          <Search size={15} />
          {busy ? t("common.loading") : t("common.search")}
        </button>
      </form>

      {error && <p className="rv-error-text">{error}</p>}

      {results !== null && results.length === 0 && !busy && (
        <p style={{ margin: 0, color: "var(--rv-text-muted)", fontSize: 12 }}>
          {t("explore.noResults")}
        </p>
      )}

      {results && results.length > 0 && (
        <div className="rv-result-grid">
          {results.slice(0, 12).map((user) => (
            <button
              key={user.id}
              className="rv-result"
              disabled={busy}
              onClick={() => void link(user)}
            >
              <img
                className="rv-result-avatar"
                src={user.avatarUrl ?? undefined}
                alt=""
                aria-hidden
              />
              <span className="rv-result-body">
                <strong>{displayNameOf(user)}</strong>
                <small>@{user.name}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
