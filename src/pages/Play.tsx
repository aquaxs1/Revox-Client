import { AlertTriangle, Play as PlayIcon, Plus } from "lucide-react";
import { useMemo } from "react";
import type { Game } from "../contracts/entities";
import { mostRecentGame, splitDuration } from "../domain/stats";
import { useI18n } from "../i18n";
import { useAppStore } from "../state/AppStore";
import { GameCard } from "../components/GameCard";

/** Colors the session cards cycle through, mirroring the dashboard mockup. */
const SESSION_COLORS = ["#F58A24", "#F5A524", "#35C759", "#2E9BF0", "#F2557A"];

export function PlayPage({
  onLaunch,
  onAddGame,
}: {
  onLaunch: (game: Game) => void;
  onAddGame: () => void;
}) {
  const { t, locale } = useI18n();
  const { state, isFavorite, toggleFavorite, playtimeSeconds } = useAppStore();

  const hero = useMemo(
    () => mostRecentGame(state.sessions, state.games) ?? state.games[0] ?? null,
    [state.games, state.sessions],
  );

  const favourites = state.games.filter((game) => isFavorite(game.id));

  // The hero backdrop is a fixed 4x3 grid. With fewer covers than cells the
  // available ones repeat, so the mosaic never renders with holes in it.
  const covers = state.games
    .map((game) => game.imageUrl)
    .filter((url): url is string => Boolean(url));
  const mosaic =
    covers.length === 0
      ? []
      : Array.from({ length: 12 }, (_, index) => covers[index % covers.length]);

  const recentSessions = state.sessions
    .filter((session) => session.durationSeconds !== null)
    .slice(0, 6);

  const dateFormat = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rv-page">
      <div className="rv-play">
        <div style={{ display: "grid", gap: "var(--rv-gap)" }}>
          <section className="rv-hero">
            <div className="rv-hero-mosaic" aria-hidden>
              {mosaic.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className="rv-hero-tile"
                  style={{ backgroundImage: `url("${url}")` }}
                />
              ))}
            </div>

            <div className="rv-hero-body">
              {hero ? (
                <>
                  <p className="rv-eyebrow">{t("play.hero.eyebrow")}</p>
                  <h2>{hero.name}</h2>
                  <button
                    className="rv-button is-play"
                    onClick={() => onLaunch(hero)}
                  >
                    <PlayIcon size={18} fill="currentColor" />
                    {t("play.play")}
                  </button>
                  <small>{t("play.playHint")}</small>
                </>
              ) : (
                <>
                  <h2>{t("play.hero.empty")}</h2>
                  <p style={{ color: "var(--rv-text-muted)", maxWidth: "46ch" }}>
                    {t("play.hero.emptyBody")}
                  </p>
                  <button className="rv-button is-primary" onClick={onAddGame}>
                    <Plus size={16} />
                    {t("play.addGame")}
                  </button>
                </>
              )}
            </div>
          </section>

          <section>
            <div className="rv-section-head">
              <h2>{t("play.favourites")}</h2>
              <button className="rv-button is-ghost" onClick={onAddGame}>
                <Plus size={16} />
                {t("play.addGame")}
              </button>
            </div>

            {favourites.length === 0 ? (
              <div className="rv-empty">
                <p>{t("play.favouritesEmpty")}</p>
              </div>
            ) : (
              <div className="rv-row">
                {favourites.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    favorite
                    playtimeSeconds={playtimeSeconds(game.id)}
                    onPlay={() => onLaunch(game)}
                    onToggleFavorite={() => void toggleFavorite(game.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <section>
          <div className="rv-section-head">
            <h2>{t("play.lastSessions")}</h2>
          </div>

          {recentSessions.length === 0 ? (
            <div className="rv-empty">
              <p>{t("play.noSessions")}</p>
            </div>
          ) : (
            <div className="rv-sessions">
              {recentSessions.map((session, index) => {
                const game = state.games.find((entry) => entry.id === session.gameId);
                const { hours, minutes } = splitDuration(session.durationSeconds ?? 0);
                return (
                  <article
                    key={session.id}
                    className="rv-session-card"
                    style={{
                      ["--session-color" as string]:
                        SESSION_COLORS[index % SESSION_COLORS.length],
                    }}
                  >
                    <strong>{game?.name ?? `ID ${session.placeId ?? "?"}`}</strong>
                    <span>
                      {hours > 0
                        ? t("stats.hours", { count: `${hours}:${String(minutes).padStart(2, "0")}` })
                        : t("stats.minutes", { count: minutes })}
                      {" · "}
                      {dateFormat.format(new Date(session.startedAt))}
                    </span>
                    {session.possibleCrash && (
                      <span className="rv-session-flag">
                        <AlertTriangle size={12} />
                        {t("play.possibleCrash")}
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
