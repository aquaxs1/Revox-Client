import type { Locale } from "../i18n";

export type Availability<T> =
  | { status: "available"; value: T }
  | { status: "unavailable"; reason: string }
  | { status: "error"; code: string; message: string };

export interface AppSettings {
  locale: Locale;
}

export interface SettingsInput {
  locale: Locale;
}

export interface AppBootstrap {
  settings: AppSettings;
  accounts: unknown[];
  games: unknown[];
  sessions: unknown[];
}

export type RobloxState = "ready" | "notFound" | "running" | "checkFailed";

export interface RobloxStatus {
  state: RobloxState;
  installationPath: string | null;
  detail: string | null;
}

export interface LaunchRequest {
  placeId: string;
  accountProfileId: string | null;
  performanceProfileId: string;
}

export interface LaunchReceipt {
  uri: string;
  activityId: string;
  acceptedAt: string;
}
