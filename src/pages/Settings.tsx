import {
  Bell,
  Check,
  Cpu,
  DownloadCloud,
  Gamepad2,
  Info,
  Languages,
  Link2,
  MonitorCog,
  PanelBottom,
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
  const {
    state,
    backend,
    saveSettings,
    refreshSystem,
    linkRobloxAccount,
    unlinkRobloxAccount,
    setAutostart,
  } = useAppStore();
  const { settings, system } = state;
  const [robux, setRobux] = useState(String(settings.robuxSpent));
  const [robloxName, setRobloxName] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [discordId, setDiscordId] = useState(settings.discordApplicationId ?? "");
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(
    null,
  );

  useEffect(() => {
    setRobux(String(settings.robuxSpent));
  }, [settings.robuxSpent]);

  useEffect(() => {
    setDiscordId(settings.discordApplicationId ?? "");
  }, [settings.discordApplicationId]);

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

  /** Runs a platform action and turns any failure into a readable line. */
  async function run(action: () => Promise<void>, success?: string) {
    setNotice(null);
    try {
      await action();
      if (success) setNotice({ text: success, tone: "ok" });
    } catch (reason) {
      const failure = toBackendError(reason);
      setNotice({
        text: translateError(failure.code, failure.message),
        tone: "error",
      });
    }
  }

  function commitDiscordId() {
    const trimmed = discordId.trim();
    void run(async () => {
      await saveSettings({ discordApplicationId: trimmed || null });
    });
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
              <div className="rv-field">
                <label htmlFor="rv-roblox-username">
                  {t("settings.robloxAccount.placeholder")}
                </label>
                <input
                  id="rv-roblox-username"
                  className="rv-input"
                  value={robloxName}
                  onChange={(event) => setRobloxName(event.target.value)}
                  placeholder="Builderman"
                  required
                />
              </div>
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
          <PanelBottom size={20} aria-hidden />
          <div>
            <h2>{t("settings.tray")}</h2>
            <p>{t("settings.trayBody")}</p>
          </div>
        </div>

        <div className="rv-setting-row">
          <div>
            <strong>{t("settings.minimizeToTray")}</strong>
          </div>
          <div
            className="rv-segmented"
            role="group"
            aria-label={t("settings.minimizeToTray")}
          >
            <button
              aria-pressed={settings.minimizeToTray}
              onClick={() => void saveSettings({ minimizeToTray: true })}
            >
              {t("settings.tracking.on")}
            </button>
            <button
              aria-pressed={!settings.minimizeToTray}
              onClick={() => void saveSettings({ minimizeToTray: false })}
            >
              {t("settings.tracking.off")}
            </button>
          </div>
        </div>

        <div className="rv-setting-row">
          <div>
            <strong>{t("settings.autostart")}</strong>
          </div>
          <div className="rv-segmented" role="group" aria-label={t("settings.autostart")}>
            <button
              aria-pressed={settings.autostartEnabled}
              onClick={() => void run(() => setAutostart(true))}
            >
              {t("settings.tracking.on")}
            </button>
            <button
              aria-pressed={!settings.autostartEnabled}
              onClick={() => void run(() => setAutostart(false))}
            >
              {t("settings.tracking.off")}
            </button>
          </div>
        </div>
      </section>

      <section className="rv-settings-section">
        <div className="rv-settings-title">
          <Bell size={20} aria-hidden />
          <div>
            <h2>{t("settings.notifications")}</h2>
            <p>{t("settings.notificationsBody")}</p>
          </div>
        </div>

        <div className="rv-setting-row">
          <div>
            <strong>{t("settings.notifyFriends")}</strong>
            {!settings.robloxUserId && <span>{t("settings.notifyNeedsAccount")}</span>}
          </div>
          <div
            className="rv-segmented"
            role="group"
            aria-label={t("settings.notifyFriends")}
          >
            <button
              aria-pressed={settings.notifyFriends}
              disabled={!settings.robloxUserId}
              onClick={() => void saveSettings({ notifyFriends: true })}
            >
              {t("settings.tracking.on")}
            </button>
            <button
              aria-pressed={!settings.notifyFriends}
              onClick={() => void saveSettings({ notifyFriends: false })}
            >
              {t("settings.tracking.off")}
            </button>
          </div>
        </div>
      </section>

      <section className="rv-settings-section">
        <div className="rv-settings-title">
          <Gamepad2 size={20} aria-hidden />
          <div>
            <h2>{t("settings.discord")}</h2>
            <p>{t("settings.discordBody")}</p>
          </div>
        </div>

        <div className="rv-setting-row">
          <div>
            <strong>{t("settings.discordEnabled")}</strong>
          </div>
          <div
            className="rv-segmented"
            role="group"
            aria-label={t("settings.discordEnabled")}
          >
            <button
              aria-pressed={settings.discordEnabled}
              disabled={!settings.discordApplicationId}
              onClick={() => void saveSettings({ discordEnabled: true })}
            >
              {t("settings.tracking.on")}
            </button>
            <button
              aria-pressed={!settings.discordEnabled}
              onClick={() => void saveSettings({ discordEnabled: false })}
            >
              {t("settings.tracking.off")}
            </button>
          </div>
        </div>

        <div className="rv-setting-row">
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="rv-field">
              <label htmlFor="rv-discord-id">{t("settings.discordAppId")}</label>
              <input
                id="rv-discord-id"
                className="rv-input"
                value={discordId}
                onChange={(event) => setDiscordId(event.target.value)}
                onBlur={commitDiscordId}
                placeholder="123456789012345678"
                inputMode="numeric"
              />
              <small>{t("settings.discordAppIdHint")}</small>
            </div>
          </div>
          <button
            className="rv-button"
            disabled={!settings.discordEnabled}
            onClick={() =>
              void run(() => backend.discordConnect(), t("settings.discordConnected"))
            }
          >
            {t("settings.discordTest")}
          </button>
        </div>
      </section>

      <section className="rv-settings-section">
        <div className="rv-settings-title">
          <DownloadCloud size={20} aria-hidden />
          <div>
            <h2>{t("settings.updates")}</h2>
            <p>{t("settings.updatesBody")}</p>
          </div>
        </div>
        <div className="rv-setting-row">
          <div>
            <strong>{t("settings.version", { version: APP_VERSION })}</strong>
          </div>
          <button
            className="rv-button"
            onClick={() =>
              void run(async () => {
                const version = await backend.checkForUpdate();
                setNotice({
                  tone: "ok",
                  text: version
                    ? t("settings.updateAvailable", { version })
                    : t("settings.upToDate"),
                });
              })
            }
          >
            <RefreshCw size={15} />
            {t("settings.checkUpdate")}
          </button>
        </div>
      </section>

      {notice && (
        <p className={notice.tone === "error" ? "rv-error-text" : "rv-note"}>
          {notice.text}
        </p>
      )}

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
