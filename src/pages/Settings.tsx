import { Check, Monitor, ShieldCheck, SlidersHorizontal, Type } from "lucide-react";
import { useAppStore } from "../state/AppStore";
import type { AppearanceSettings } from "../state/types";

const accentOptions: Array<{ id: AppearanceSettings["accent"]; label: string; color: string }> = [
  { id: "cyan", label: "Signal Cyan", color: "#45d6e8" },
  { id: "coral", label: "Pulse Coral", color: "#ff7a6f" },
  { id: "lime", label: "Volt Lime", color: "#9fe870" },
];

export function SettingsPage() {
  const { state, updateAppearance } = useAppStore();
  const { appearance } = state;

  return (
    <div className="page settings-page">
      <section className="page-heading"><p className="eyebrow">DEIN RIFT</p><h1>Darstellung & Sicherheit</h1><p>Passe nur den Launcher an. Roblox-Dateien und Roblox-Schriften bleiben unberührt.</p></section>

      <section className="settings-section">
        <div className="settings-section-title"><Monitor size={21} /><div><h2>Oberfläche</h2><p>Theme und Farbsignal für alle Bereiche.</p></div></div>
        <div className="setting-row"><div><strong>Darstellung</strong><span>Heller oder dunkler Arbeitsbereich</span></div><div className="segmented-control"><button className={appearance.theme === "dark" ? "is-active" : ""} onClick={() => updateAppearance({ theme: "dark" })}>Dunkel</button><button className={appearance.theme === "light" ? "is-active" : ""} onClick={() => updateAppearance({ theme: "light" })}>Hell</button></div></div>
        <div className="setting-row"><div><strong>Akzentfarbe</strong><span>Markierungen, Status und Fokus</span></div><div className="swatch-group">{accentOptions.map((accent) => <button key={accent.id} className={appearance.accent === accent.id ? "swatch is-active" : "swatch"} onClick={() => updateAppearance({ accent: accent.id })} aria-label={accent.label} title={accent.label} style={{ "--swatch-color": accent.color } as React.CSSProperties}>{appearance.accent === accent.id && <Check size={14} />}</button>)}</div></div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title"><Type size={21} /><div><h2>Schrift</h2><p>Die Auswahl gilt ausschließlich im Launcher.</p></div></div>
        <div className="font-grid">
          <button className={appearance.font === "system" ? "font-option is-active" : "font-option"} onClick={() => updateAppearance({ font: "system" })}><span className="font-preview system-font">Aa</span><strong>Interface</strong><small>Präzise und neutral</small></button>
          <button className={appearance.font === "condensed" ? "font-option is-active" : "font-option"} onClick={() => updateAppearance({ font: "condensed" })}><span className="font-preview condensed-font">Aa</span><strong>Condensed</strong><small>Kompakt und technisch</small></button>
          <button className={appearance.font === "rounded" ? "font-option is-active" : "font-option"} onClick={() => updateAppearance({ font: "rounded" })}><span className="font-preview rounded-font">Aa</span><strong>Rounded</strong><small>Weich und freundlich</small></button>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title"><SlidersHorizontal size={21} /><div><h2>Dichte</h2><p>Mehr Überblick oder mehr Abstand.</p></div></div>
        <div className="setting-row"><div><strong>Layout-Dichte</strong><span>Beeinflusst Listen und Karten</span></div><div className="segmented-control"><button className={appearance.density === "compact" ? "is-active" : ""} onClick={() => updateAppearance({ density: "compact" })}>Kompakt</button><button className={appearance.density === "comfortable" ? "is-active" : ""} onClick={() => updateAppearance({ density: "comfortable" })}>Komfortabel</button></div></div>
      </section>

      <section className="settings-safety">
        <div className="settings-section-title"><ShieldCheck size={22} /><div><p className="eyebrow">FESTE GRENZEN</p><h2>Sicherer Companion, kein Client-Mod</h2></div></div>
        <div className="boundary-list"><span><Check size={16} /> Offizieller Roblox-Startfluss</span><span><Check size={16} /> Lokale Profile ohne Login-Daten</span><span><Check size={16} /> Keine Injection oder Cheats</span><span><Check size={16} /> Keine Client- oder Font-Dateiänderungen</span><span><Check size={16} /> Kein Cookie-Zugriff</span><span><Check size={16} /> Keine versteckte Prozessautomatisierung</span></div>
      </section>
    </div>
  );
}
