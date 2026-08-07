import { Filter, Heart, Plus, Search, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useAppStore } from "../state/AppStore";

export function LibraryPage({ onLaunch }: { onLaunch: (gameId: string) => void }) {
  const { state, addGame, selectGame, toggleFavorite } = useAppStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Alle");
  const [showAdd, setShowAdd] = useState(false);
  const [reference, setReference] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const filters = ["Alle", "Favoriten", "Action", "Horror", "Roleplay"];

  const games = useMemo(
    () =>
      state.games.filter((game) => {
        const matchesQuery = `${game.title} ${game.genre}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesFilter =
          filter === "Alle" ||
          (filter === "Favoriten" ? game.favorite : game.genre === filter);
        return matchesQuery && matchesFilter;
      }),
    [filter, query, state.games],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!addGame(reference, title)) {
      setError("Gib eine numerische Place-ID oder einen offiziellen Roblox-Spiel-Link ein.");
      return;
    }
    setError("");
    setReference("");
    setTitle("");
    setShowAdd(false);
  }

  return (
    <div className="page">
      <section className="page-heading split-heading">
        <div>
          <p className="eyebrow">DEINE SAMMLUNG</p>
          <h1>Deine Spiele</h1>
          <p>{state.games.length} Erlebnisse · {state.games.filter((game) => game.favorite).length} Favoriten</p>
        </div>
        <button className="primary-button" onClick={() => setShowAdd(true)}>
          <Plus size={18} /> Spiel hinzufügen
        </button>
      </section>

      <section className="library-tools">
        <label className="search-field">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Spiele durchsuchen"
            aria-label="Spiele durchsuchen"
          />
          {query && <button onClick={() => setQuery("")} aria-label="Suche leeren"><X size={16} /></button>}
        </label>
        <div className="segmented-control" aria-label="Bibliothek filtern">
          <Filter size={16} />
          {filters.map((entry) => (
            <button
              key={entry}
              className={filter === entry ? "is-active" : ""}
              onClick={() => setFilter(entry)}
            >
              {entry}
            </button>
          ))}
        </div>
      </section>

      {showAdd && (
        <form className="add-game-panel" onSubmit={submit}>
          <div>
            <p className="eyebrow">OFFIZIELLE REFERENZ</p>
            <h2>Spiel zur Bibliothek hinzufügen</h2>
          </div>
          <label>
            <span>Roblox-Link oder Place-ID</span>
            <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="https://www.roblox.com/games/…" autoFocus />
          </label>
          <label>
            <span>Eigener Name <small>optional</small></span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Mein Lieblingsspiel" />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="inline-actions">
            <button type="button" className="secondary-button" onClick={() => setShowAdd(false)}>Abbrechen</button>
            <button className="primary-button"><Plus size={17} /> Hinzufügen</button>
          </div>
        </form>
      )}

      <section className="library-grid" aria-live="polite">
        {games.map((game) => (
          <article className="library-card" key={game.id}>
            <div className="library-cover">
              <div
                className="cover-art"
                style={{
                  backgroundImage: `url(${game.thumbnail})`,
                  backgroundPosition: game.coverPosition,
                }}
              />
              <span style={{ background: game.accent }}>{game.genre}</span>
              <button
                aria-label={`Favorit für ${game.title} umschalten`}
                className={game.favorite ? "cover-action is-active" : "cover-action"}
                onClick={() => toggleFavorite(game.id)}
              >
                <Heart size={17} fill={game.favorite ? "currentColor" : "none"} />
              </button>
            </div>
            <div className="library-card-body">
              <div><h2>{game.title}</h2><p>{game.description}</p></div>
              <div className="library-meta"><span>{Math.floor(game.playMinutes / 60)} Std.</span><span>{game.lastPlayed ?? "Noch nicht gespielt"}</span></div>
              <button
                className="secondary-button full-width"
                onClick={() => { selectGame(game.id); onLaunch(game.id); }}
              >
                Offiziell starten
              </button>
            </div>
          </article>
        ))}
        {games.length === 0 && <div className="empty-state"><Search size={28} /><h2>Keine Spiele gefunden</h2><p>Ändere Suche oder Filter.</p></div>}
      </section>
    </div>
  );
}
