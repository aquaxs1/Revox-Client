import { CalendarDays, Clock3, Gamepad2, Signal, TrendingUp } from "lucide-react";
import { useAppStore } from "../state/AppStore";

export function Stats() {
  const { state } = useAppStore();
  const totalMinutes = state.sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const averageFps = Math.round(state.sessions.reduce((sum, session) => sum + session.avgFps, 0) / state.sessions.length);
  const averagePing = Math.round(state.sessions.reduce((sum, session) => sum + session.ping, 0) / state.sessions.length);
  const maxDuration = Math.max(...state.sessions.map((session) => session.durationMinutes));

  return (
    <div className="page">
      <section className="page-heading split-heading">
        <div><p className="eyebrow">LETZTE 7 TAGE</p><h1>Deine Spielwoche</h1><p>Lokale Beispielwerte zeigen, wie der spätere Session-Bericht aussehen wird.</p></div>
        <button className="secondary-button"><CalendarDays size={18} /> 29. Juli – 4. August</button>
      </section>

      <section className="metric-grid">
        <article><span><Clock3 size={18} /> Spielzeit</span><strong>{Math.floor(totalMinutes / 60)}<small> Std.</small></strong><p>+12% zur Vorwoche</p></article>
        <article><span><Gamepad2 size={18} /> Sessions</span><strong>{state.sessions.length}</strong><p>3 Spiele gestartet</p></article>
        <article><span><TrendingUp size={18} /> Ø Bildrate</span><strong>{averageFps}<small> FPS</small></strong><p>stabiler Verlauf</p></article>
        <article><span><Signal size={18} /> Ø Ping</span><strong>{averagePing}<small> ms</small></strong><p>gute Verbindung</p></article>
      </section>

      <section className="stats-layout">
        <article className="chart-panel">
          <div className="section-heading"><div><p className="eyebrow">SPIELZEIT</p><h2>Rhythmus der Woche</h2></div><span className="legend-mark">Minuten</span></div>
          <div className="bar-chart" aria-label="Spielzeit pro Tag">
            {state.sessions.map((session) => (
              <div key={session.id} className="bar-column">
                <span>{session.durationMinutes}</span>
                <i style={{ height: `${(session.durationMinutes / maxDuration) * 100}%` }} />
                <small>{session.date.split(" ")[0]}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="game-share-panel">
          <div><p className="eyebrow">MEISTGESPIELT</p><h2>DOORS</h2><p>281 Minuten diese Woche</p></div>
          <div className="ring-chart"><span><strong>42%</strong><small>deiner Zeit</small></span></div>
          <div className="share-list"><span><i className="cyan" /> DOORS <b>42%</b></span><span><i className="amber" /> Brookhaven <b>29%</b></span><span><i className="coral" /> Andere <b>29%</b></span></div>
        </article>
      </section>

      <section className="session-table-section">
        <div className="section-heading"><div><p className="eyebrow">VERLAUF</p><h2>Letzte Sessions</h2></div></div>
        <div className="session-table" role="table">
          <div className="session-row table-head" role="row"><span>Spiel</span><span>Datum</span><span>Dauer</span><span>Ø FPS</span><span>Ping</span></div>
          {state.sessions.slice().reverse().slice(0, 5).map((session) => {
            const game = state.games.find((entry) => entry.id === session.gameId)!;
            return <div className="session-row" role="row" key={session.id}><span><i style={{ backgroundImage: `url(${game.thumbnail})`, backgroundPosition: game.coverPosition }} />{game.title}</span><span>{session.date}</span><span>{session.durationMinutes} Min.</span><span>{session.avgFps}</span><span>{session.ping} ms</span></div>;
          })}
        </div>
      </section>
    </div>
  );
}
