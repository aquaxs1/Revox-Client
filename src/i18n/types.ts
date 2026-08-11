import type { de } from "./de";

export type Locale = "de" | "en";
export type TranslationKey = keyof typeof de;
export type TranslationParams = Record<string, string | number>;

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  /** Resolves a backend error code to a readable sentence. */
  translateError: (code: string, fallback?: string) => string;
}
