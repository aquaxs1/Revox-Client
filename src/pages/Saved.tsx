import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Game } from "../contracts/entities";
import { useI18n } from "../i18n";
import { useAppStore } from "../state/AppStore";
import { Dialog } from "../components/Dialog";
import { GameCard } from "../components/GameCard";

export function SavedPage({
  onLaunch,
  onAddGame,
}: {
  onLaunch: (game: Game) => void;
  onAddGame: () => void;
}) {
  const { t } = useI18n();
  const { state, isFavorite, toggleFavorite, playtimeSeconds, removeGame, refreshGame } =
    useAppStore();
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<Game | null>(null);

  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return state.games;
    return state.games.filter((game) =>
      `${game.name} ${game.tags.join(" ")} ${game.placeId}`
        .toLowerCase()
        .includes(needle),
    );
  }, [query, state.games]);

  const favourites = matching.filter((game) => isFavorite(game.id));
  const rest = matching.filter((game) => !isFavorite(game.id));

  function renderGrid(games: Game[], emptyLabel: string) {
    if (games.length === 0) {
      return (
        <div className="rv-empty">
          <p>{emptyLabel}</p>
        </div>
      );
    }
    return (
      <div className="rv-game-grid">
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            favorite={isFavorite(game.id)}
            playtimeSeconds={playtimeSeconds(game.id)}
            onPlay={() => onLaunch(game)}
            onToggleFavorite={() => void toggleFavorite(game.id)}
            onRemove={() => setRemoving(game)}
            onRefresh={() => void refreshGame(game)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="rv-page">
      <div className="rv-section-head">
        <label className="rv-field" style={{ flex: 1, maxWidth: 360 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={15} aria-hidden />
            <input
              className="rv-input"
              style={{ flex: 1 }}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("saved.searchPlaceholder")}
              aria-label={t("saved.searchPlaceholder")}
            />
          </span>
        </label>
        <button className="rv-button is-primary" onClick={onAddGame}>
          <Plus size={16} />
          {t("saved.addGame")}
        </button>
      </div>

      <section>
        <div className="rv-section-head">
          <h2>{t("saved.favourites")}</h2>
        </div>
        {renderGrid(favourites, t("saved.noFavourites"))}
      </section>

      <section>
        <div className="rv-section-head">
          <h2>{t("saved.browse")}</h2>
        </div>
        {renderGrid(rest, t("saved.noGames"))}
      </section>

      {removing && (
        <Dialog title={t("saved.remove")} onClose={() => setRemoving(null)}>
          <p style={{ margin: 0 }}>
            {t("saved.removeQuestion", { name: removing.name })}
          </p>
          <div className="rv-dialog-actions">
            <button className="rv-button is-ghost" onClick={() => setRemoving(null)}>
              {t("common.cancel")}
            </button>
            <button
              className="rv-button is-danger"
              onClick={() => {
                void removeGame(removing.id);
                setRemoving(null);
              }}
            >
              {t("common.delete")}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
