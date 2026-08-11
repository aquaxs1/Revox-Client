import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Bookmark,
  Play,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import type {
  CatalogItem,
  GameServer,
  GameStats,
  GameSummary,
  RobloxUser,
  UserStats,
  WatchKind,
} from "../contracts/entities";
import { parsePlaceId } from "../domain/roblox";
import {
  bestServer,
  displayNameOf,
  followersPerFriend,
  likeRatio,
  rankServers,
  resaleMarkup,
  serverSpread,
  visitsPerActivePlayer,
} from "../domain/roblox-stats";
import { formatCount } from "../domain/stats";
import { useI18n } from "../i18n";
import { toBackendError } from "../services/backend";
import { useAppStore } from "../state/AppStore";
import { StatGrid, type Stat } from "../components/StatGrid";
import { WatchHistory } from "../components/WatchHistory";

type Tab = "users" | "games" | "items";

type Detail =
  | { kind: "user"; data: UserStats }
  | { kind: "game"; data: GameStats; servers: GameServer[] | null }
  | { kind: "item"; data: CatalogItem };

const TABS: Tab[] = ["users", "games", "items"];

export function ExplorePage({
  onToast,
}: {
  onToast: (text: string, tone: "success" | "error") => void;
}) {
  const { t, locale, translateError } = useI18n();
  const { state, backend, addWatch, removeWatch, isWatched, launchPlace, addGame } =
    useAppStore();

  const [tab, setTab] = useState<Tab>("users");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<RobloxUser[] | null>(null);
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  const number = useCallback(
    (value: number | null | undefined) =>
      value === null || value === undefined ? null : formatCount(value, locale),
    [locale],
  );

  const fail = useCallback(
    (reason: unknown) => {
      const failure = toBackendError(reason);
      setError(translateError(failure.code, failure.message));
    },
    [translateError],
  );

  const openUser = useCallback(
    async (userId: string) => {
      setBusy(true);
      setError(null);
      try {
        setDetail({ kind: "user", data: await backend.getUserStats(userId) });
      } catch (reason) {
        fail(reason);
      } finally {
        setBusy(false);
      }
    },
    [backend, fail],
  );

  const openGame = useCallback(
    async (universeId: string, placeId: string | null) => {
      setBusy(true);
      setError(null);
      try {
        const data = placeId
          ? await backend.getGameStatsForPlace(placeId)
          : await backend.getGameStats(universeId);
        setDetail({ kind: "game", data, servers: null });

        // Servers are a second request and are allowed to fail on their own:
        // a private or empty experience still deserves its stats page.
        const rootPlaceId = data.rootPlaceId || placeId;
        if (rootPlaceId) {
          try {
            const servers = await backend.getGameServers(rootPlaceId);
            setDetail({ kind: "game", data, servers });
          } catch {
            setDetail({ kind: "game", data, servers: [] });
          }
        }
      } catch (reason) {
        fail(reason);
      } finally {
        setBusy(false);
      }
    },
    [backend, fail],
  );

  const openItem = useCallback(
    async (assetId: string) => {
      setBusy(true);
      setError(null);
      try {
        setDetail({ kind: "item", data: await backend.getCatalogItem(assetId) });
      } catch (reason) {
        fail(reason);
      } finally {
        setBusy(false);
      }
    },
    [backend, fail],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDetail(null);
    try {
      if (tab === "users") {
        // A bare number is a user ID, so it jumps straight to the profile.
        if (/^\d{1,20}$/.test(query.trim())) {
          await openUser(query.trim());
          return;
        }
        setUsers(await backend.searchUsers(query));
      } else if (tab === "games") {
        const placeId = parsePlaceId(query);
        if (placeId) {
          await openGame("", placeId);
          return;
        }
        setGames(await backend.searchGames(query));
      } else {
        if (/^\d{1,20}$/.test(query.trim())) {
          await openItem(query.trim());
          return;
        }
        setItems(await backend.searchCatalog(query));
      }
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }

  async function toggleWatch(
    kind: WatchKind,
    targetId: string,
    label: string,
    imageUrl: string | null,
  ) {
    try {
      const existing = state.watchlist.find(
        (entry) => entry.kind === kind && entry.targetId === targetId,
      );
      if (existing) {
        await removeWatch(existing.id);
      } else {
        await addWatch({ kind, targetId, label, imageUrl });
      }
    } catch (reason) {
      const failure = toBackendError(reason);
      onToast(translateError(failure.code, failure.message), "error");
    }
  }

  function watchButton(
    kind: WatchKind,
    targetId: string,
    label: string,
    imageUrl: string | null,
  ) {
    const watched = isWatched(kind, targetId);
    return (
      <button
        className="rv-button"
        aria-pressed={watched}
        onClick={() => void toggleWatch(kind, targetId, label, imageUrl)}
      >
        <Bookmark size={15} fill={watched ? "currentColor" : "none"} />
        {watched ? t("explore.unwatch") : t("explore.watch")}
      </button>
    );
  }

  function openWatchlistEntry(kind: WatchKind, targetId: string) {
    if (kind === "user") return void openUser(targetId);
    if (kind === "asset") return void openItem(targetId);
    return void openGame(targetId, null);
  }

  const results = tab === "users" ? users : tab === "games" ? games : items;

  return (
    <div className="rv-page">
      <div className="rv-tabs">
        {TABS.map((entry) => (
          <button
            key={entry}
            className="rv-tab"
            aria-pressed={tab === entry}
            onClick={() => {
              setTab(entry);
              setDetail(null);
              setError(null);
            }}
          >
            {t(`explore.tab.${entry}` as const)}
          </button>
        ))}
      </div>

      <form className="rv-section-head" onSubmit={submit}>
        <label className="rv-field" style={{ flex: 1, maxWidth: 460 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={15} aria-hidden />
            <input
              className="rv-input"
              style={{ flex: 1 }}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(`explore.search.${tab}` as const)}
              aria-label={t(`explore.search.${tab}` as const)}
              required
            />
          </span>
          {tab === "games" && <small>{t("explore.searchHint.games")}</small>}
        </label>
        <button className="rv-button is-primary" type="submit" disabled={busy}>
          {busy ? t("common.loading") : t("common.search")}
        </button>
      </form>

      {error && (
        <div className="rv-empty">
          <strong>{error}</strong>
        </div>
      )}

      {detail ? (
        <>
          <button className="rv-button is-ghost" onClick={() => setDetail(null)}>
            <ArrowLeft size={15} />
            {t("explore.back")}
          </button>

          {detail.kind === "user" && (
            <UserDetail
              stats={detail.data}
              number={number}
              watchButton={watchButton}
              onJoin={(placeId, instanceId) => void launchPlace(placeId, instanceId)}
            />
          )}

          {detail.kind === "game" && (
            <GameDetail
              stats={detail.data}
              servers={detail.servers}
              number={number}
              watchButton={watchButton}
              onJoin={(placeId, instanceId) => void launchPlace(placeId, instanceId)}
              onAddToLibrary={async (placeId) => {
                try {
                  const { game } = await addGame(placeId);
                  onToast(game.name, "success");
                } catch (reason) {
                  const failure = toBackendError(reason);
                  onToast(translateError(failure.code, failure.message), "error");
                }
              }}
            />
          )}

          {detail.kind === "item" && (
            <ItemDetail item={detail.data} number={number} watchButton={watchButton} />
          )}
        </>
      ) : (
        <>
          {results === null && !busy && !error && (
            <div className="rv-empty">
              <p>{t("explore.startSearching")}</p>
            </div>
          )}

          {results !== null && results.length === 0 && !busy && (
            <div className="rv-empty">
              <p>{t("explore.noResults")}</p>
            </div>
          )}

          {tab === "users" && users && users.length > 0 && (
            <div className="rv-result-grid">
              {users.map((user) => (
                <button
                  key={user.id}
                  className="rv-result"
                  onClick={() => void openUser(user.id)}
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
                  {user.hasVerifiedBadge && <BadgeCheck size={16} aria-hidden />}
                </button>
              ))}
            </div>
          )}

          {tab === "games" && games && games.length > 0 && (
            <div className="rv-result-grid">
              {games.map((game) => (
                <button
                  key={game.universeId}
                  className="rv-result"
                  onClick={() => void openGame(game.universeId, game.rootPlaceId || null)}
                >
                  <img
                    className="rv-result-thumb"
                    src={game.iconUrl ?? undefined}
                    alt=""
                    aria-hidden
                  />
                  <span className="rv-result-body">
                    <strong>{game.name}</strong>
                    <small>
                      {game.creatorName}
                      {game.playing !== null &&
                        ` · ${t("saved.playersOnline", {
                          count: number(game.playing) ?? "0",
                        })}`}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}

          {tab === "items" && items && items.length > 0 && (
            <div className="rv-result-grid">
              {items.map((item) => (
                <button
                  key={item.id}
                  className="rv-result"
                  onClick={() => void openItem(item.id)}
                >
                  <img
                    className="rv-result-thumb"
                    src={item.imageUrl ?? undefined}
                    alt=""
                    aria-hidden
                  />
                  <span className="rv-result-body">
                    <strong>{item.name}</strong>
                    <small>
                      {item.creatorName}
                      {item.price !== null && ` · R$ ${number(item.price)}`}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}

          <section>
            <div className="rv-section-head">
              <h2>{t("explore.watchlist")}</h2>
            </div>
            {state.watchlist.length === 0 ? (
              <div className="rv-empty">
                <p>{t("explore.watchlistEmpty")}</p>
              </div>
            ) : (
              <div className="rv-result-grid">
                {state.watchlist.map((entry) => (
                  <button
                    key={entry.id}
                    className="rv-result"
                    onClick={() => openWatchlistEntry(entry.kind, entry.targetId)}
                  >
                    <img
                      className="rv-result-thumb"
                      src={entry.imageUrl ?? undefined}
                      alt=""
                      aria-hidden
                    />
                    <span className="rv-result-body">
                      <strong>{entry.label}</strong>
                      <small>{t(`explore.tab.${kindToTab(entry.kind)}` as const)}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function kindToTab(kind: WatchKind): Tab {
  if (kind === "user") return "users";
  if (kind === "game") return "games";
  return "items";
}

type NumberFormatter = (value: number | null | undefined) => string | null;
type WatchButton = (
  kind: WatchKind,
  targetId: string,
  label: string,
  imageUrl: string | null,
) => React.ReactNode;

function UserDetail({
  stats,
  number,
  watchButton,
  onJoin,
}: {
  stats: UserStats;
  number: NumberFormatter;
  watchButton: WatchButton;
  onJoin: (placeId: string, instanceId: string | null) => void;
}) {
  const { t, locale } = useI18n();
  const { user, presence } = stats;
  const dateFormat = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
    dateStyle: "medium",
  });

  const ratio = followersPerFriend(stats.followers, stats.friends);
  const joinPlaceId = presence?.rootPlaceId ?? presence?.placeId ?? null;
  const joinable =
    presence?.state === "inGame" && joinPlaceId && presence.gameInstanceId;

  const facts: Stat[] = [
    { label: t("user.followers"), value: number(stats.followers) },
    { label: t("user.following"), value: number(stats.following) },
    { label: t("user.friends"), value: number(stats.friends) },
    { label: t("user.groups"), value: number(stats.groups) },
    {
      label: t("user.accountAge"),
      value:
        user.accountAgeDays === null
          ? null
          : t("user.accountAgeValue", { days: number(user.accountAgeDays) ?? "0" }),
    },
    {
      label: t("user.created"),
      value: user.created ? dateFormat.format(new Date(user.created)) : null,
    },
    {
      label: t("user.followRatio"),
      value: ratio === null ? null : ratio.toFixed(1),
    },
    { label: t("user.userId"), value: user.id },
  ];

  return (
    <div style={{ display: "grid", gap: "var(--rv-gap)" }}>
      <section className="rv-detail-head">
        <img
          className="rv-detail-avatar"
          src={user.avatarUrl ?? undefined}
          alt=""
          aria-hidden
        />
        <div className="rv-detail-title">
          <h2>
            {displayNameOf(user)}
            {user.hasVerifiedBadge && <BadgeCheck size={18} aria-label={t("user.verified")} />}
            {user.isBanned && <Ban size={18} aria-label={t("user.banned")} />}
          </h2>
          <p>@{user.name}</p>
          <span className="rv-status" data-state={presence?.state ?? "unknown"}>
            <i />
            {t(`presence.${presence?.state ?? "unknown"}` as const)}
            {presence?.lastLocation ? ` · ${presence.lastLocation}` : ""}
          </span>
        </div>
        <div className="rv-detail-actions">
          {watchButton("user", user.id, displayNameOf(user), user.avatarUrl)}
          {joinable && (
            <button
              className="rv-button is-play"
              onClick={() => onJoin(joinPlaceId, presence.gameInstanceId)}
            >
              <Play size={15} fill="currentColor" />
              {t("friends.join")}
            </button>
          )}
        </div>
      </section>

      {presence?.state === "inGame" && !joinable && (
        <p className="rv-note">{t("presence.hidden")}</p>
      )}

      <StatGrid stats={facts} />

      <section className="rv-settings-section">
        <div className="rv-settings-title">
          <Users size={18} aria-hidden />
          <div>
            <h2>{t("user.about")}</h2>
          </div>
        </div>
        <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--rv-text-muted)" }}>
          {user.description.trim() || t("user.noDescription")}
        </p>
      </section>

      <WatchHistory kind="user" targetId={user.id} />
    </div>
  );
}

function GameDetail({
  stats,
  servers,
  number,
  watchButton,
  onJoin,
  onAddToLibrary,
}: {
  stats: GameStats;
  servers: GameServer[] | null;
  number: NumberFormatter;
  watchButton: WatchButton;
  onJoin: (placeId: string, instanceId: string | null) => void;
  onAddToLibrary: (placeId: string) => void;
}) {
  const { t, locale } = useI18n();
  const dateFormat = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
    dateStyle: "medium",
  });

  const ratio = likeRatio(stats);
  const perPlayer = visitsPerActivePlayer(stats);
  const spread = servers ? serverSpread(servers) : null;
  const ranked = servers ? rankServers(servers) : [];
  const best = servers ? bestServer(servers) : null;
  const placeId = stats.rootPlaceId;

  const facts: Stat[] = [
    { label: t("game.playing"), value: number(stats.playing) },
    { label: t("game.visits"), value: number(stats.visits) },
    { label: t("game.favorites"), value: number(stats.favorites) },
    { label: t("game.likes"), value: number(stats.upVotes) },
    { label: t("game.dislikes"), value: number(stats.downVotes) },
    {
      label: t("game.likeRatio"),
      value: ratio === null ? null : `${ratio.toFixed(1)} %`,
    },
    { label: t("game.maxPlayers"), value: number(stats.maxPlayers) },
    { label: t("game.genre"), value: stats.genre || null },
    {
      label: t("game.created"),
      value: stats.created ? dateFormat.format(new Date(stats.created)) : null,
    },
    {
      label: t("game.updated"),
      value: stats.updated ? dateFormat.format(new Date(stats.updated)) : null,
    },
    {
      label: t("game.visitsPerPlayer"),
      value: perPlayer === null ? null : number(Math.round(perPlayer)),
    },
    { label: t("game.creator"), value: stats.creatorName || null },
    { label: t("game.universeId"), value: stats.universeId },
    { label: t("game.placeId"), value: placeId || null },
  ];

  return (
    <div style={{ display: "grid", gap: "var(--rv-gap)" }}>
      <section className="rv-detail-head">
        <img
          className="rv-detail-thumb"
          src={stats.iconUrl ?? undefined}
          alt=""
          aria-hidden
        />
        <div className="rv-detail-title">
          <h2>{stats.name}</h2>
          <p>{stats.creatorName}</p>
        </div>
        <div className="rv-detail-actions">
          {watchButton("game", stats.universeId, stats.name, stats.iconUrl)}
          {placeId && (
            <>
              <button className="rv-button" onClick={() => onAddToLibrary(placeId)}>
                <Plus size={15} />
                {t("game.addToLibrary")}
              </button>
              <button className="rv-button is-play" onClick={() => onJoin(placeId, null)}>
                <Play size={15} fill="currentColor" />
                {t("play.play")}
              </button>
            </>
          )}
        </div>
      </section>

      <StatGrid stats={facts} />

      <section className="rv-settings-section">
        <div className="rv-section-head">
          <h2>{t("game.servers")}</h2>
          {spread && (
            <span style={{ color: "var(--rv-text-muted)", fontSize: 12 }}>
              {t("game.fullServers", { count: number(spread.full) ?? "0" })} ·{" "}
              {t("game.medianFill")}: {spread.medianFillPercent.toFixed(0)} %
            </span>
          )}
        </div>

        {servers === null ? (
          <p style={{ margin: 0, color: "var(--rv-text-muted)" }}>{t("common.loading")}</p>
        ) : servers.length === 0 ? (
          <div className="rv-empty">
            <p>{t("game.serversEmpty")}</p>
          </div>
        ) : (
          <div className="rv-server-list">
            {ranked.slice(0, 25).map((server) => (
              <div
                className="rv-server"
                key={server.id}
                data-best={server.id === best?.id}
              >
                <span className="rv-meter" aria-hidden>
                  <i style={{ width: `${server.fillPercent}%` }} />
                </span>
                <span className="rv-server-count">
                  {server.playing}/{server.maxPlayers}
                  {server.id === best?.id && (
                    <b className="rv-server-best">{t("explore.bestServer")}</b>
                  )}
                  {!server.joinable && (
                    <b className="rv-server-full">{t("explore.serverFull")}</b>
                  )}
                </span>
                <span className="rv-server-ping">
                  {server.ping === null ? "—" : `${server.ping} ms`}
                </span>
                <button
                  className="rv-button is-play"
                  onClick={() => placeId && onJoin(placeId, server.id)}
                  disabled={!placeId || !server.joinable}
                >
                  <Play size={14} fill="currentColor" />
                  {t("game.joinServer")}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <WatchHistory kind="game" targetId={stats.universeId} />
    </div>
  );
}

function ItemDetail({
  item,
  number,
  watchButton,
}: {
  item: CatalogItem;
  number: NumberFormatter;
  watchButton: WatchButton;
}) {
  const { t, locale } = useI18n();
  const dateFormat = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
    dateStyle: "medium",
  });

  const markup = resaleMarkup(item.recentAveragePrice, item.originalPrice);
  const price =
    item.price === null
      ? item.isLimited || item.isLimitedUnique
        ? t("item.offSale")
        : null
      : item.price === 0
        ? t("item.free")
        : `R$ ${number(item.price)}`;

  const facts: Stat[] = [
    { label: t("item.price"), value: price },
    {
      label: t("item.lowestPrice"),
      value: item.lowestPrice === null ? null : `R$ ${number(item.lowestPrice)}`,
    },
    { label: t("item.favorites"), value: number(item.favoriteCount) },
    { label: t("item.sales"), value: number(item.sales) },
    { label: t("item.remaining"), value: number(item.numberRemaining) },
    {
      label: t("item.rap"),
      value:
        item.recentAveragePrice === null
          ? null
          : `R$ ${number(item.recentAveragePrice)}`,
    },
    {
      label: t("item.originalPrice"),
      value: item.originalPrice === null ? null : `R$ ${number(item.originalPrice)}`,
    },
    {
      label: t("item.rapSpread"),
      value: markup === null ? null : `${markup > 0 ? "+" : ""}${markup.toFixed(0)} %`,
    },
    {
      label: t("item.created"),
      value: item.created ? dateFormat.format(new Date(item.created)) : null,
    },
    { label: t("item.creator"), value: item.creatorName || null },
    { label: t("item.type"), value: item.itemType || null },
    { label: t("item.assetId"), value: item.id },
  ];

  return (
    <div style={{ display: "grid", gap: "var(--rv-gap)" }}>
      <section className="rv-detail-head">
        <img
          className="rv-detail-thumb"
          src={item.imageUrl ?? undefined}
          alt=""
          aria-hidden
        />
        <div className="rv-detail-title">
          <h2>{item.name}</h2>
          <p>{item.creatorName}</p>
          <div style={{ display: "flex", gap: 6 }}>
            {item.isLimited && <span className="rv-tag is-active">{t("item.limited")}</span>}
            {item.isLimitedUnique && (
              <span className="rv-tag is-active">{t("item.limitedUnique")}</span>
            )}
          </div>
        </div>
        <div className="rv-detail-actions">
          {watchButton("asset", item.id, item.name, item.imageUrl)}
        </div>
      </section>

      <StatGrid stats={facts} />

      {item.description.trim() && (
        <section className="rv-settings-section">
          <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--rv-text-muted)" }}>
            {item.description}
          </p>
        </section>
      )}

      <WatchHistory kind="asset" targetId={item.id} />
    </div>
  );
}
