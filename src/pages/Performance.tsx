import { Check, Cpu, Gauge, MemoryStick, MonitorCog, Thermometer, Wifi } from "lucide-react";
import { useAppStore } from "../state/AppStore";

export function Performance() {
  const { state, setPerformanceProfile } = useAppStore();
  const active = state.profiles.find((profile) => profile.id === state.performanceProfileId)!;

  return (
    <div className="page">
      <section className="page-heading">
        <p className="eyebrow">SESSION TUNING</p>
        <h1>Performance-Profile</h1>
        <p>Lokale Empfehlungen für deinen Spielstil. Roblox-Einstellungen werden nicht automatisch verändert.</p>
      </section>
      <div className="active-profile-line"><span className="status-light" /> Aktives Profil: {active.name}</div>

      <section className="performance-grid">
        {state.profiles.map((profile) => {
          const selected = profile.id === state.performanceProfileId;
          return (
            <article className={selected ? "performance-card is-selected" : "performance-card"} key={profile.id}>
              <div className="performance-card-head">
                <span className="profile-glyph"><Gauge size={23} /></span>
                {profile.recommended && <span className="recommended-chip">EMPFOHLEN</span>}
                {selected && <span className="selected-check"><Check size={15} /></span>}
              </div>
              <div><h2>{profile.name}</h2><p>{profile.description}</p></div>
              <dl>
                <div><dt>Ziel</dt><dd>{profile.fpsTarget}</dd></div>
                <div><dt>Grafik</dt><dd>{profile.graphics}</dd></div>
                <div><dt>Hintergrund</dt><dd>{profile.backgroundApps}</dd></div>
              </dl>
              <button
                className={selected ? "secondary-button full-width is-confirmed" : "secondary-button full-width"}
                onClick={() => setPerformanceProfile(profile.id)}
                aria-label={`${profile.name}-Profil aktivieren`}
              >
                {selected ? "Aktiv" : "Profil aktivieren"}
              </button>
            </article>
          );
        })}
      </section>

      <section className="diagnostic-section">
        <div className="section-heading">
          <div><p className="eyebrow">SYSTEM-CHECK</p><h2>Dein Setup</h2></div>
          <span className="scan-time">Zuletzt geprüft: vor 4 Min.</span>
        </div>
        <div className="diagnostic-grid">
          <article><Cpu size={20} /><div><span>Prozessor</span><strong>AMD Ryzen 7</strong><small>Auslastung 34%</small></div><b>Gut</b></article>
          <article><MonitorCog size={20} /><div><span>Grafik</span><strong>NVIDIA RTX</strong><small>Auslastung 48%</small></div><b>Gut</b></article>
          <article><MemoryStick size={20} /><div><span>Arbeitsspeicher</span><strong>16 GB</strong><small>8,3 GB verfügbar</small></div><b>Gut</b></article>
          <article><Wifi size={20} /><div><span>Verbindung</span><strong>12 ms</strong><small>Stabil</small></div><b>Gut</b></article>
        </div>
      </section>

      <section className="recommendation-band">
        <Thermometer size={22} />
        <div><strong>Empfehlung für dieses Gerät</strong><p>„Ausgeglichen“ hält Reserven für Discord und Browser offen, ohne die Bildrate spürbar zu begrenzen.</p></div>
        <button className="text-button">Details ansehen</button>
      </section>
    </div>
  );
}
