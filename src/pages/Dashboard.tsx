import {
  ArrowRight,
  Clock3,
  Cpu,
  Heart,
  Play,
  Radio,
  Sparkles,
  Wifi,
} from "lucide-react";
import type { PageId } from "../components/AppShell";
import { useAppStore } from "../state/AppStore";

interface DashboardProps {
  onLaunch: (gameId: string) => void;
  onNavigate: (page: PageId) => void;
}

export function Dashboard({ onLaunch, onNavigate }: DashboardProps) {
  const { state, selectGame, toggleFavorite } = useAppStore();
  const game = state.games.find((entry) => entry.id === state.selectedGameId)!;
  const account = state.accounts.find(
    (entry) => entry.id === state.selectedAccountId,
  )!;
  const profile = state.profiles.find(
    (entry) => entry.id === state.performanceProfileId,
  )!;
  const favorites = state.games.filter((entry) => entry.favorite).slice(0, 3);

  return (
    <div className="page page-dashboard">
      <section className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">GUTEN ABEND, SEBI</p>
          <h1>Bereit zum Spielen</h1>
          <p>Ein Startpunkt. Deine Spiele, Profile und letzten Sessions.</p>
        </div>
        <div className="daily-signal">
          <Sparkles size={17} />
          <span>7 Tage-Serie</span>
          <strong>04</strong>
        </div>
      </section>

      <section
        className="launch-rail"
        style={{ "--game-accent": game.accent } as React.CSSProperties}
      >
        <div
          className="launch-rail-image cover-art"
          style={{
            backgroundImage: `url(${game.thumbnail})`,
            backgroundPosition: game.coverPosition,
          }}
        />
        <div className="launch-rail-shade" />
        <div className="rail-index">
          <span>JETZT</span>
          <b>01</b>
        </div>
        <div className="rail-game">
          <p>{game.genre} · zuletzt {game.lastPlayed ?? "nie"}</p>
          <h2>{game.title}</h2>
          <span>{game.description}</span>
        </div>
        <div className="rail-context">
          <div>
            <small>Profil</small>
            <strong>{account.username}</strong>
          </div>
          <div>
            <small>Leistung</small>
            <strong>{profile.name}</strong>
          </div>
          <div>
            <small>Status</small>
            <strong className="online-copy">Bereit</strong>
          </div>
        </div>
        <button
          className="launch-button"
          onClick={() => onLaunch(game.id)}
          aria-label={`${game.title} starten`}
        >
          <Play size={22} fill="currentColor" />
          <span>SPIEL STARTEN</span>
        </button>
      </section>

      <div className="dashboard-grid">
        <section className="content-section favorites-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SCHNELLZUGRIFF</p>
              <h2>Favoriten</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate("library")}>
              Alle Spiele <ArrowRight size={16} />
            </button>
          </div>
          <div className="favorite-grid">
            {favorites.map((favorite) => (
              <article
                className={
                  favorite.id === game.id ? "game-tile is-selected" : "game-tile"
                }
                key={favorite.id}
                onClick={() => selectGame(favorite.id)}
              >
                <div className="game-cover">
                  <div
                    className="cover-art"
                    style={{
                      backgroundImage: `url(${favorite.thumbnail})`,
                      backgroundPosition: favorite.coverPosition,
                    }}
                  />
                  <button
                    className="cover-action"
                    aria-label={`Favorit ${favorite.title} entfernen`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleFavorite(favorite.id);
                    }}
                  >
                    <Heart size={16} fill="currentColor" />
                  </button>
                </div>
                <div className="game-tile-copy">
                  <strong>{favorite.title}</strong>
                  <span>{favorite.genre}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="content-section pulse-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">LETZTE SESSION</p>
              <h2>Session Pulse</h2>
            </div>
            <span className="live-chip"><Radio size={13} /> stabil</span>
          </div>
          <div className="pulse-primary">
            <strong>1:24</strong>
            <span>Stunden gespielt</span>
          </div>
          <div className="pulse-chart" aria-label="FPS-Verlauf der letzten Session">
            {[72, 82, 68, 91, 76, 88, 95, 84, 91, 86, 98, 89].map(
              (height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ),
            )}
          </div>
          <div className="pulse-stats">
            <div><span>Ø FPS</span><strong>120</strong></div>
            <div><span>Ping</span><strong>30 ms</strong></div>
            <div><span>RAM</span><strong>3,8 GB</strong></div>
          </div>
        </section>
      </div>

      <section className="system-strip">
        <div className="system-label">
          <p className="eyebrow">SYSTEM SNAPSHOT</p>
          <strong>Alles im grünen Bereich</strong>
        </div>
        <div><Cpu size={18} /><span>CPU</span><strong>34%</strong><i><b style={{ width: "34%" }} /></i></div>
        <div><Sparkles size={18} /><span>GPU</span><strong>48%</strong><i><b style={{ width: "48%" }} /></i></div>
        <div><Clock3 size={18} /><span>RAM</span><strong>52%</strong><i><b style={{ width: "52%" }} /></i></div>
        <div><Wifi size={18} /><span>Netz</span><strong>12 ms</strong><i><b style={{ width: "22%" }} /></i></div>
      </section>
    </div>
  );
}
