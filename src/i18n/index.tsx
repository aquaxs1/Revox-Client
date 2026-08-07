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
import type { I18nContextValue, Locale } from "./types";

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLocale = navigator.language.toLowerCase().startsWith("de") ? "de" : "en",
  onLocaleChange,
}: {
  children: ReactNode;
  initialLocale?: Locale;
  onLocaleChange?: (locale: Locale) => Promise<void> | void;
}) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const dictionary = locale === "de" ? de : en;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    async (nextLocale: Locale) => {
      updateLocale(nextLocale);
      await onLocaleChange?.(nextLocale);
    },
    [onLocaleChange],
  );

  const t = useCallback(
    (key: keyof typeof de, values: Record<string, string | number> = {}) =>
      Object.entries(values).reduce(
        (copy, [name, replacement]) =>
          copy.replaceAll(`{${name}}`, String(replacement)),
        dictionary[key] as string,
      ),
    [dictionary],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

export type { I18nContextValue, Locale, TranslationKey } from "./types";
