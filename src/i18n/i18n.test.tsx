import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { de } from "./de";
import { en } from "./en";
import { I18nProvider, useI18n } from "./index";

function LanguageProbe() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div>
      <p>{t("settings.language.current", { language: locale.toUpperCase() })}</p>
      <button type="button" onClick={() => void setLocale("en")}>
        {t("settings.language.english")}
      </button>
    </div>
  );
}

describe("application translations", () => {
  it("keeps German and English dictionaries structurally identical", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
  });

  it("interpolates named values", () => {
    render(
      <I18nProvider initialLocale="de">
        <LanguageProbe />
      </I18nProvider>,
    );

    expect(screen.getByText("Aktuelle Sprache: DE")).toBeInTheDocument();
  });

  it("changes rendered copy without reloading the app", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider initialLocale="de">
        <LanguageProbe />
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Englisch" }));

    expect(screen.getByText("Current language: EN")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "English" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });
});
