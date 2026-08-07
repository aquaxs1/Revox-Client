import type { de } from "./de";

export const en = {
  "settings.language.current": "Current language: {language}",
  "settings.language.english": "English",
} as const satisfies Record<keyof typeof de, string>;
