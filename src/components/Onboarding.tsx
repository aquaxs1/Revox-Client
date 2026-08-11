import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import type { ThemeMode } from "../contracts/entities";
import { useI18n } from "../i18n";
import type { Locale } from "../i18n/types";
import { useAppStore } from "../state/AppStore";
import { Logo } from "./Logo";

const TOTAL_STEPS = 2;

/**
 * First-run setup. Two steps, matching the onboarding screens in the design:
 * a welcome, then language and theme.
 *
 * Both choices are written immediately so the rest of the app already renders
 * in the chosen language and theme by the time the user reaches the dashboard.
 */
export function Onboarding() {
  const { t, locale, setLocale } = useI18n();
  const { state, saveSettings } = useAppStore();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

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
        <Logo size={92} variant="full" title={t("app.name")} />
        <p className="rv-onboarding-step">
          {t("onboarding.step", { current: step, total: TOTAL_STEPS })}
        </p>

        {step === 1 ? (
          <>
            <h1>{t("onboarding.welcome.title")}</h1>
            <p>{t("onboarding.welcome.body")}</p>
            <button className="rv-button is-primary" onClick={() => setStep(2)}>
              {t("onboarding.welcome.start")}
              <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <>
            <h1>{t("onboarding.setup.title")}</h1>
            <p>{t("onboarding.setup.body")}</p>

            <div className="rv-onboarding-choices">
              <div className="rv-onboarding-choice">
                <strong>{t("onboarding.setup.language")}</strong>
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
              </div>

              <div className="rv-onboarding-choice">
                <strong>{t("onboarding.setup.theme")}</strong>
                <div className="rv-segmented" role="group">
                  {(["dark", "light", "system"] as ThemeMode[]).map((theme) => (
                    <button
                      key={theme}
                      aria-pressed={state.settings.theme === theme}
                      onClick={() => void saveSettings({ theme })}
                    >
                      {t(`settings.theme.${theme}` as const)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rv-exit-actions">
              <button className="rv-button is-ghost" onClick={() => setStep(1)}>
                {t("common.back")}
              </button>
              <button
                className="rv-button is-primary"
                onClick={() => void finish()}
                disabled={busy}
              >
                <Check size={16} />
                {t("onboarding.setup.finish")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
