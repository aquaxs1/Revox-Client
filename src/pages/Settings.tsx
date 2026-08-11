import {
  Check,
  Cpu,
  Info,
  Languages,
  MonitorCog,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Spacing, ThemeMode } from "../contracts/entities";
import { useI18n } from "../i18n";
import type { Locale, TranslationKey } from "../i18n/types";
import { useAppStore } from "../state/AppStore";
import { APP_VERSION } from "../version";

export const ACCENT_PRESETS = [
  "#2E9BF0",
  "#5BC8F5",
  "#35C759",
  "#F5A524",
  "#F2557A",
  "#A46BF5",
];

const THEMES: ThemeMode[] = ["dark", "light", "system"];
const SPACINGS: Spacing[] = ["compact", "comfortable", "spacious"];

const BOUNDARY_KEYS: TranslationKey[] = [
  "settings.boundary.official",
  "settings.boundary.noPasswords",
  "settings.boundary.noInjection",
  "settings.boundary.noFiles",
  "settings.boundary.local",
];

function formatBytes(bytes: number | null, locale: string): string | null {
  if (bytes === null) return null;
  const gigabytes = bytes / 1024 ** 3;
  return `${new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US", {
    maximumFractionDigits: 1,
  }).format(gigabytes)} GB`;
}

export function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { state, saveSettings, refreshSystem } = useAppStore();
  const { settings, system } = state;
  const [robux, setRobux] = useState(String(settings.robuxSpent));

  useEffect(() => {
    setRobux(String(settings.robuxSpent));
  }, [settings.robuxSpent]);

  useEffect(() => {
    void refreshSystem();
  }, [refreshSystem]);

  async function chooseLocale(next: Locale) {
    setLocale(next);
    await saveSettings({ locale: next });
  }

  function commitRobux() {
    const parsed = Number.parseInt(robux, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      setRobux(String(settings.robuxSpent));
      return;
    }
    void saveSettings({ robuxSpent: parsed });
  }

  const notAvailable = t("common.notAvailable");
  const memory =
    system?.memoryTotalBytes !== null && system?.memoryTotalBytes !== undefined
      ? formatBytes(system.memoryTotalBytes, locale)
      : null;

  return (
    <div className="rv-page">
      <section className="rv-settings-section">
        <div className="rv-settings-title">
          <MonitorCog size={20} aria-hidden />
          <div>
            <h2>{t("settings.appearance")}</h2>
            <p>{t("settings.appearanceBody")}</p>
          </div>
        </div>

        <div className="rv-setting-row">
          <div>
            <strong>{t("settings.theme")}</strong>
          </div>
          <div className="rv-segmented" role="group" aria-label={t("settings.theme")}>
            {THEMES.map((theme) => (
              <button
                key={theme}
                aria-pressed={settings.theme === theme}
                onClick={() => void saveSettings({ theme })}
              >
                {t(`settings.theme.${theme}` as const)}
              </button>
            ))}
          </div>
        </div>

        <div className="rv-setting-row">
          <div>
            <strong>{t("settings.accent")}</strong>
          </div>
          <div className="rv-swatches" role="group" aria-label={t("settings.accent")}>
            {ACCENT_PRESETS.map((accent) => (
              <button
                key={accent}
                className="rv-swatch"
                style={{ ["--swatch-color" as string]: accent }}
                aria-pressed={settings.accent.toUpperCase() === accent.toUpperCase()}
                aria-label={accent}
                onClick={() => void saveSettings({ accent })}
              >
                {settings.accent.toUpperCase() === accent.toUpperCase() && (
                  <Check size={13} />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="rv-setting-row">
          <div>
            <strong>{t("settings.density")}</strong>
          </div>
          <div className="rv-segmented" role="group" aria-label={t("settings.density")}>
            {SPACINGS.map((spacing) => (
              <button
                key={spacing}
                aria-pressed={settings.spacing === spacing}
                onClick={() => void saveSettings({ spacing })}
              >
                {t(`settings.density.${spacing}` as const)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rv-settings-section">
        <div className="rv-settings-title">
          <Languages size={20} aria-hidden />
          <div>
            <h2>{t("settings.language")}</h2>
          </div>
        </div>
        <div className="rv-setting-row">
          <div>
            <strong>{t("settings.language")}</strong>
          </div>
          <div className="rv-segmented" role="group" aria-label={t("settings.language")}>
            <button
              aria-pressed={locale === "de"}
              onClick={() => void chooseLocale("de")}
            >
              {t("settings.language.german")}
            </button>
            <button
              aria-pressed={locale === "en"}
              onClick={() => void chooseLocale("en")}
            >
              {t("settings.language.english")}
            </button>
          </div>
        </div>
      </section>

      <section className="rv-settings-section">
        <div className="rv-settings-title">
          <SlidersHorizontal size={20} aria-hidden />
          <div>
            <h2>{t("settings.tracking")}</h2>
            <p>{t("settings.robuxBody")}</p>
          </div>
        </div>
        <div className="rv-setting-row">
          <div>
            <strong>{t("settings.robux")}</strong>
          </div>
          <input
            className="rv-input"
            style={{ width: 160 }}
            type="number"
            min={0}
            value={robux}
            onChange={(event) => setRobux(event.target.value)}
            onBlur={commitRobux}
            aria-label={t("settings.robux")}
          />
        </div>
      </section>

      <section className="rv-settings-section">
        <div className="rv-settings-title">
          <Cpu size={20} aria-hidden />
          <div>
            <h2>{t("settings.system")}</h2>
          </div>
          <button
            className="rv-button is-ghost"
            style={{ marginLeft: "auto" }}
            onClick={() => void refreshSystem()}
          >
            <RefreshCw size={15} />
            {t("settings.system.refresh")}
          </button>
        </div>

        <div className="rv-facts">
          <div className="rv-fact">
            <span>{t("settings.system.os")}</span>
            <strong>{system?.osName ?? notAvailable}</strong>
          </div>
          <div className="rv-fact">
            <span>{t("settings.system.cpu")}</span>
            <strong>
              {system?.cpuName ?? notAvailable}
              {system?.cpuCores ? ` · ${system.cpuCores} Cores` : ""}
            </strong>
          </div>
          <div className="rv-fact">
            <span>{t("settings.system.gpu")}</span>
            <strong>{system?.gpuName ?? notAvailable}</strong>
          </div>
          <div className="rv-fact">
            <span>{t("settings.system.memory")}</span>
            <strong>{memory ?? notAvailable}</strong>
          </div>
        </div>
      </section>

      <section className="rv-settings-section">
        <div className="rv-settings-title">
          <ShieldCheck size={20} aria-hidden />
          <div>
            <h2>{t("settings.boundaries")}</h2>
            <p>{t("settings.boundariesBody")}</p>
          </div>
        </div>
        <div className="rv-boundaries">
          {BOUNDARY_KEYS.map((key) => (
            <div className="rv-boundary" key={key}>
              <Check size={15} aria-hidden />
              <span>{t(key)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rv-settings-section">
        <div className="rv-settings-title">
          <Info size={20} aria-hidden />
          <div>
            <h2>{t("settings.about")}</h2>
            <p>{t("settings.version", { version: APP_VERSION })}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
