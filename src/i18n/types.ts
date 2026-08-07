import type { de } from "./de";

export type Locale = "de" | "en";

export interface I18nContextValue {
  locale: Locale;
  setLocale(locale: Locale): Promise<void>;
  t(key: TranslationKey, values?: Record<string, string | number>): string;
}

export type TranslationKey = keyof typeof de;
