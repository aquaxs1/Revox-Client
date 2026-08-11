import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { de } from "./de";
import { en } from "./en";
import type {
  I18nContextValue,
  Locale,
  TranslationKey,
  TranslationParams,
} from "./types";

export type { Locale, TranslationKey } from "./types";

const I18nContext = createContext<I18nContextValue | null>(null);

const DICTIONARIES: Record<Locale, Record<string, string>> = { de, en };

export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "de";
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

/** Replaces `{name}` placeholders with the supplied values. */
export function format(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/**
 * `locale` is the persisted setting; `setLocale` switches the visible language
 * immediately. Callers persist the choice themselves, and the new setting flows
 * back in through the prop.
 */
export function I18nProvider({
  children,
  locale,
}: {
  children: ReactNode;
  locale: Locale;
}) {
  const [current, setCurrent] = useState<Locale>(locale);

  useEffect(() => setCurrent(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = current;
  }, [current]);

  const setLocale = useCallback((next: Locale) => setCurrent(next), []);

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = DICTIONARIES[current];
    const t = (key: TranslationKey, params?: TranslationParams) =>
      format(dictionary[key] ?? key, params);

    return {
      locale: current,
      setLocale,
      t,
      translateError: (code, fallback) => {
        const key = `error.${code}`;
        if (key in dictionary) return dictionary[key];
        return fallback ?? dictionary["error.UNEXPECTED"];
      },
    };
  }, [current, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside an I18nProvider");
  }
  return value;
}
