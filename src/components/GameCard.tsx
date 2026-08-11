import { Bookmark, Gamepad2, Play, RefreshCw, Trash2 } from "lucide-react";
import type { Game } from "../contracts/entities";
import { formatCount, splitDuration } from "../domain/stats";
import { useI18n } from "../i18n";

/**
 * One game tile: cover, name, and the bookmark/play pair from the mockups.
 */
export function GameCard({
  game,
  favorite,
  playtimeSeconds,
  onPlay,
  onToggleFavorite,
  onRemove,
  onRefresh,
}: {
  game: Game;
  favorite: boolean;
  playtimeSeconds: number;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onRemove?: () => void;
  onRefresh?: () => void;
}) {
  const { t, locale } = useI18n();
  const { hours, minutes } = splitDuration(playtimeSeconds);

  return (
    <article className="rv-game-card">
      <div
        className={game.imageUrl ? "rv-game-cover" : "rv-game-cover is-blank"}
        style={
          game.imageUrl ? { backgroundImage: `url("${game.imageUrl}")` } : undefined
        }
      >
        {!game.imageUrl && <Gamepad2 size={30} aria-hidden />}
        {game.playing !== null && game.playing > 0 && (
          <span className="rv-game-online">
            {t("saved.playersOnline", { count: formatCount(game.playing, locale) })}
          </span>
        )}
      </div>

      <div className="rv-game-body">
        <strong title={game.name}>{game.name}</strong>
        <small>
          {playtimeSeconds > 0
            ? hours > 0
              ? t("stats.hours", { count: hours })
              : t("stats.minutes", { count: minutes })
            : `ID ${game.placeId}`}
        </small>
      </div>

      <div className="rv-game-actions">
        <button
          className="rv-icon-button is-bookmark"
          data-active={favorite}
          onClick={onToggleFavorite}
          aria-pressed={favorite}
          aria-label={favorite ? t("saved.unbookmark") : t("saved.bookmark")}
          title={favorite ? t("saved.unbookmark") : t("saved.bookmark")}
        >
          <Bookmark size={15} fill={favorite ? "currentColor" : "none"} />
        </button>

        {onRefresh && (
          <button
            className="rv-icon-button"
            onClick={onRefresh}
            aria-label={t("saved.refresh")}
            title={t("saved.refresh")}
          >
            <RefreshCw size={15} />
          </button>
        )}

        {onRemove && (
          <button
            className="rv-icon-button"
            onClick={onRemove}
            aria-label={t("saved.remove")}
            title={t("saved.remove")}
          >
            <Trash2 size={15} />
          </button>
        )}

        <span className="rv-spacer" />

        <button
          className="rv-icon-button is-play"
          onClick={onPlay}
          aria-label={`${t("play.play")}: ${game.name}`}
          title={t("play.play")}
        >
          <Play size={15} fill="currentColor" />
        </button>
      </div>
    </article>
  );
}
