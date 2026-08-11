import { ArrowLeft, ArrowRight, Check, PartyPopper } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { ThemeMode } from "../contracts/entities";
import { useI18n } from "../i18n";
import type { Locale, TranslationKey } from "../i18n/types";
import { isTauri } from "../services/backend";
import { useAppStore } from "../state/AppStore";
import { Logo } from "./Logo";
import { RobloxAccountLink } from "./RobloxAccountLink";

const STEPS = 5;

/**
 * First-run setup, styled as the client itself rather than as an installer
 * page — it *is* the client, so the two never drift apart.
 *
 * Every choice is written the moment it is made, so quitting halfway still
 * leaves a configured app, and nothing here is a dead end: each toggle also
 * lives in Settings.
 */
export function Onboarding() {
  const { t, locale, setLocale } = useI18n();
  const { state, saveSettings, setAutostart } = useAppStore();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const { settings } = state;

  async function chooseLocale(next: Locale) {
    setLocale(next);
    await saveSettings({ locale: next });
  }

  async function finish() {
    setBusy(true);
    try {
      await saveSettings({ onboardingComplete: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rv-onboarding">
      <div className="rv-onboarding-card">
        <Logo size={step === 1 || step === STEPS ? 92 : 56} variant="full" title={t("app.name")} />
        <p className="rv-onboarding-step">
          {t("onboarding.step", { current: step, total: STEPS })}
        </p>

        {step === 1 && (
          <>
            <h1>{t("onboarding.welcome.title")}</h1>
            <p>{t("onboarding.welcome.body")}</p>
            <button className="rv-button is-primary" onClick={() => setStep(2)}>
              {t("onboarding.welcome.start")}
              <ArrowRight size={16} />
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h1>{t("onboarding.setup.title")}</h1>
            <p>{t("onboarding.setup.body")}</p>

            <div className="rv-onboarding-choices">
              <Choice label={t("onboarding.setup.language")}>
                <div className="rv-segmented" role="group">
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
              </Choice>

              <Choice label={t("onboarding.setup.theme")}>
                <div className="rv-segmented" role="group">
                  {(["dark", "light", "system"] as ThemeMode[]).map((theme) => (
                    <button
                      key={theme}
                      aria-pressed={settings.theme === theme}
                      onClick={() => void saveSettings({ theme })}
                    >
                      {t(`settings.theme.${theme}` as const)}
                    </button>
                  ))}
                </div>
              </Choice>
            </div>

            <Navigation onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </>
        )}

        {step === 3 && (
          <>
            <h1>{t("setup.defaults.title")}</h1>
            <p>{t("setup.defaults.body")}</p>

            <div className="rv-onboarding-choices">
              <Toggle
                label="setup.tracking"
                hint="setup.trackingHint"
                value={settings.statsTrackingEnabled}
                onChange={(value) => void saveSettings({ statsTrackingEnabled: value })}
              />
              <Toggle
                label="setup.tray"
                hint="setup.trayHint"
                value={settings.minimizeToTray}
                onChange={(value) => void saveSettings({ minimizeToTray: value })}
              />
              {isTauri() && (
                <Toggle
                  label="setup.autostart"
                  hint="setup.autostartHint"
                  value={settings.autostartEnabled}
                  onChange={(value) => {
                    // Autostart can be refused by the OS; the setting only
                    // moves if the registration actually succeeded.
                    void setAutostart(value).catch(() => {});
                  }}
                />
              )}
            </div>

            <Navigation onBack={() => setStep(2)} onNext={() => setStep(4)} />
          </>
        )}

        {step === 4 && (
          <>
            <h1>{t("setup.account.title")}</h1>
            <p>{t("setup.account.body")}</p>

            <div className="rv-onboarding-panel">
              <RobloxAccountLink compact />
            </div>

            {settings.robloxUserId && (
              <div className="rv-onboarding-choices">
                <Toggle
                  label="setup.notify"
                  hint="setup.notifyHint"
                  value={settings.notifyFriends}
                  onChange={(value) => void saveSettings({ notifyFriends: value })}
                />
              </div>
            )}

            <div className="rv-exit-actions">
              <button className="rv-button is-ghost" onClick={() => setStep(3)}>
                <ArrowLeft size={16} />
                {t("common.back")}
              </button>
              <button className="rv-button is-primary" onClick={() => setStep(5)}>
                {settings.robloxUserId ? t("common.next") : t("setup.account.skip")}
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <PartyPopper size={28} aria-hidden />
            <h1>{t("setup.done.title")}</h1>
            <p>{t("setup.done.body")}</p>
            <div className="rv-exit-actions">
              <button className="rv-button is-ghost" onClick={() => setStep(4)}>
                <ArrowLeft size={16} />
                {t("common.back")}
              </button>
              <button
                className="rv-button is-primary"
                onClick={() => void finish()}
                disabled={busy}
              >
                <Check size={16} />
                {t("setup.done.start")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Choice({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rv-onboarding-choice">
      <strong>{label}</strong>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: TranslationKey;
  hint: TranslationKey;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="rv-onboarding-choice">
      <span className="rv-onboarding-choice-body">
        <strong>{t(label)}</strong>
        <small>{t(hint)}</small>
      </span>
      <div className="rv-segmented" role="group" aria-label={t(label)}>
        <button aria-pressed={value} onClick={() => onChange(true)}>
          {t("settings.tracking.on")}
        </button>
        <button aria-pressed={!value} onClick={() => onChange(false)}>
          {t("settings.tracking.off")}
        </button>
      </div>
    </div>
  );
}

function Navigation({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { t } = useI18n();
  return (
    <div className="rv-exit-actions">
      <button className="rv-button is-ghost" onClick={onBack}>
        <ArrowLeft size={16} />
        {t("common.back")}
      </button>
      <button className="rv-button is-primary" onClick={onNext}>
        {t("common.next")}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
