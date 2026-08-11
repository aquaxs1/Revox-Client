import {
  Check,
  Cpu,
  Info,
  Languages,
  Link2,
  MonitorCog,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { Spacing, ThemeMode } from "../contracts/entities";
import { useI18n } from "../i18n";
import type { Locale, TranslationKey } from "../i18n/types";
import { toBackendError } from "../services/backend";
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
  const { t, locale, setLocale, translateError } = useI18n();
  const { state, saveSettings, refreshSystem, linkRobloxAccount, unlinkRobloxAccount } =
    useAppStore();
  const { settings, system } = state;
  const [robux, setRobux] = useState(String(settings.robuxSpent));
  const [robloxName, setRobloxName] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

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

  async function submitLink(event: FormEvent) {
    event.preventDefault();
    setLinking(true);
    setLinkError(null);
    try {
      await linkRobloxAccount(robloxName);
      setRobloxName("");
    } catch (reason) {
      const failure = toBackendError(reason);
      setLinkError(translateError(failure.code, failure.message));
    } finally {
      setLinking(false);
    }
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
            <p>{t("settings.tracking.body")}</p>
          </div>
        </div>

        <div className="rv-setting-row">
          <div>
            <strong>{t("settings.tracking.enable")}</strong>
          </div>
          <div
            className="rv-segmented"
            role="group"
            aria-label={t("settings.tracking.enable")}
          >
            <button
              aria-pressed={settings.statsTrackingEnabled}
              onClick={() => void saveSettings({ statsTrackingEnabled: true })}
            >
              {t("settings.tracking.on")}
            </button>
            <button
              aria-pressed={!settings.statsTrackingEnabled}
              onClick={() => void saveSettings({ statsTrackingEnabled: false })}
            >
              {t("settings.tracking.off")}
            </button>
          </div>
        </div>

        <div className="rv-setting-row">
          <div>
            <strong>{t("settings.robux")}</strong>
            <span>{t("settings.robuxBody")}</span>
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
          <Link2 size={20} aria-hidden />
          <div>
            <h2>{t("settings.robloxAccount")}</h2>
            <p>{t("settings.robloxAccountBody")}</p>
          </div>
        </div>

        {settings.robloxUserId ? (
          <div className="rv-setting-row">
            <div>
              <strong>
                {t("settings.robloxAccount.linked", {
                  name: settings.robloxUsername ?? "?",
                  id: settings.robloxUserId,
                })}
              </strong>
            </div>
            <button
              className="rv-button"
              onClick={() => void unlinkRobloxAccount()}
            >
              {t("settings.robloxAccount.unlink")}
            </button>
          </div>
        ) : (
          <form className="rv-setting-row" onSubmit={submitLink}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label className="rv-field">
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {t("settings.robloxAccount.placeholder")}
                </span>
                <input
                  className="rv-input"
                  value={robloxName}
                  onChange={(event) => setRobloxName(event.target.value)}
                  placeholder="Builderman"
                  required
                />
              </label>
              {linkError && <p className="rv-error-text">{linkError}</p>}
            </div>
            <button className="rv-button is-primary" type="submit" disabled={linking}>
              {t("settings.robloxAccount.link")}
            </button>
          </form>
        )}
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
