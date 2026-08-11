import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { de } from "./de";
import { en } from "./en";
import { format, I18nProvider, useI18n } from "./index";

describe("translation dictionaries", () => {
  it("define exactly the same keys in German and English", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
  });

  it("leave no string empty", () => {
    for (const [key, value] of Object.entries({ ...de, ...en })) {
      expect(value.trim(), `${key} is empty`).not.toBe("");
    }
  });

  it("use the same placeholders on both sides", () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

    for (const key of Object.keys(de) as Array<keyof typeof de>) {
      expect(placeholders(en[key]), `placeholders differ for ${key}`).toEqual(
        placeholders(de[key]),
      );
    }
  });
});

describe("format", () => {
  it("replaces named placeholders", () => {
    expect(format("Step {current} of {total}", { current: 1, total: 2 })).toBe(
      "Step 1 of 2",
    );
  });

  it("leaves unknown placeholders untouched instead of printing undefined", () => {
    expect(format("Hi {name}", {})).toBe("Hi {name}");
    expect(format("Hi {name}")).toBe("Hi {name}");
  });
});

function Probe() {
  const { t, setLocale, translateError } = useI18n();
  return (
    <div>
      <p>{t("nav.play")}</p>
      <p>{translateError("INVALID_PLACE_ID")}</p>
      <p>{translateError("SOMETHING_NEW")}</p>
      <button onClick={() => setLocale("en")}>switch</button>
    </div>
  );
}

describe("I18nProvider", () => {
  it("renders the active language and switches on demand", async () => {
    render(
      <I18nProvider locale="de">
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByText("Spielen")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "switch" }));

    expect(screen.getByText("Play")).toBeInTheDocument();
  });

  it("falls back to a generic message for unknown error codes", () => {
    render(
      <I18nProvider locale="de">
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByText(de["error.INVALID_PLACE_ID"])).toBeInTheDocument();
    expect(screen.getByText(de["error.UNEXPECTED"])).toBeInTheDocument();
  });
});
