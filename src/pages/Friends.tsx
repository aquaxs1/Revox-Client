import { BadgeCheck, Play, RefreshCw, ShieldCheck, UserSearch } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FriendEntry } from "../contracts/entities";
import { displayNameOf, isJoinable, presencePlaceId } from "../domain/roblox-stats";
import { formatCount } from "../domain/stats";
import { useI18n } from "../i18n";
import { toBackendError } from "../services/backend";
import { useAppStore } from "../state/AppStore";

/**
 * The friends list of the linked public Roblox profile.
 *
 * Everything here comes from unauthenticated endpoints, so anyone whose
 * presence privacy is restricted appears offline and cannot be joined. That is
 * a limit of reading public data only, and the screen says so rather than
 * pretending the data is missing for a technical reason.
 */
export function FriendsPage({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t, locale, translateError } = useI18n();
  const { state, backend, launchPlace } = useAppStore();
  const [friends, setFriends] = useState<FriendEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = state.settings.robloxUserId;

  const load = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      setFriends(await backend.getFriends(userId));
    } catch (reason) {
      const failure = toBackendError(reason);
      setError(translateError(failure.code, failure.message));
    } finally {
      setBusy(false);
    }
  }, [backend, translateError, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!userId) {
    return (
      <div className="rv-page">
        <div className="rv-empty">
          <UserSearch size={28} aria-hidden />
          <strong>{t("friends.noAccount")}</strong>
          <p>{t("friends.noAccountBody")}</p>
          <button className="rv-button is-primary" onClick={onOpenSettings}>
            {t("friends.linkNow")}
          </button>
        </div>
      </div>
    );
  }

  const inGame = friends?.filter((entry) => entry.presence?.state === "inGame") ?? [];
  const online = friends?.filter((entry) => entry.presence?.state === "online") ?? [];

  return (
    <div className="rv-page">
      <div className="rv-section-head">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span className="rv-tag is-active">
            {t("friends.inGame", { count: formatCount(inGame.length, locale) })}
          </span>
          <span className="rv-tag is-active">
            {t("friends.onlineNow", { count: formatCount(online.length, locale) })}
          </span>
        </div>
        <button className="rv-button" onClick={() => void load()} disabled={busy}>
          <RefreshCw size={15} />
          {busy ? t("common.loading") : t("friends.refresh")}
        </button>
      </div>

      <p className="rv-note">
        <ShieldCheck size={16} aria-hidden />
        <span>{t("friends.privacyNote")}</span>
      </p>

      {error && (
        <div className="rv-empty">
          <strong>{error}</strong>
          <button className="rv-button" onClick={() => void load()}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {friends !== null && friends.length === 0 && !busy && !error && (
        <div className="rv-empty">
          <p>{t("friends.empty")}</p>
        </div>
      )}

      {friends && friends.length > 0 && (
        <div className="rv-friend-grid">
          {friends.map((entry) => {
            const joinable = isJoinable(entry.presence);
            const placeId = presencePlaceId(entry.presence);
            const presenceState = entry.presence?.state ?? "unknown";

            return (
              <article className="rv-friend" key={entry.user.id}>
                <img
                  className="rv-result-avatar"
                  src={entry.user.avatarUrl ?? undefined}
                  alt=""
                  aria-hidden
                />
                <div className="rv-friend-body">
                  <strong>
                    {displayNameOf(entry.user)}
                    {entry.user.hasVerifiedBadge && (
                      <BadgeCheck size={14} aria-label={t("user.verified")} />
                    )}
                  </strong>
                  <small>@{entry.user.name}</small>
                  <span className="rv-status" data-state={presenceState}>
                    <i />
                    {entry.presence?.lastLocation && presenceState === "inGame"
                      ? t("friends.playing", { game: entry.presence.lastLocation })
                      : t(`presence.${presenceState}` as const)}
                  </span>
                </div>

                <button
                  className="rv-button is-play"
                  disabled={!joinable}
                  title={joinable ? undefined : t("friends.joinUnavailable")}
                  onClick={() =>
                    placeId &&
                    void launchPlace(placeId, entry.presence?.gameInstanceId ?? null)
                  }
                >
                  <Play size={14} fill="currentColor" />
                  {t("friends.join")}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
