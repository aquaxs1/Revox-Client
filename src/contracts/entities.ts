import type { Locale } from "../i18n/types";

export type ThemeMode = "dark" | "light" | "system";
export type Spacing = "compact" | "comfortable" | "spacious";

/** Mirrors `contracts::AppSettings` in the Rust backend. */
export interface AppSettings {
  locale: Locale;
  theme: ThemeMode;
  accent: string;
  spacing: Spacing;
  sidebarExpanded: boolean;
  onboardingComplete: boolean;
  robuxSpent: number;
  selectedAccountId: string | null;
}

/** Every field optional: patches touch only what they carry. */
export interface SettingsInput {
  locale?: Locale;
  theme?: ThemeMode;
  accent?: string;
  spacing?: Spacing;
  sidebarExpanded?: boolean;
  onboardingComplete?: boolean;
  robuxSpent?: number;
  selectedAccountId?: string | null;
}

export interface AccountProfile {
  id: string;
  username: string;
  label: string;
  initials: string;
  color: string;
  note: string;
  avatarUrl: string | null;
}

export interface AccountInput {
  id?: string | null;
  username: string;
  label: string;
  color: string;
  note: string;
  avatarUrl?: string | null;
}

export interface Game {
  id: string;
  placeId: string;
  name: string;
  description: string;
  imageUrl: string | null;
  tags: string[];
  universeId: string | null;
  playing: number | null;
  visits: number | null;
  lastLaunchedAt: string | null;
}

export interface GameInput {
  id?: string | null;
  placeId: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  tags: string[];
}

export interface AccountGame {
  accountProfileId: string;
  gameId: string;
  favorite: boolean;
  playTimeSeconds: number;
  lastPlayedAt: string | null;
}

export interface Session {
  id: string;
  accountProfileId: string | null;
  gameId: string | null;
  placeId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  result: "running" | "completed" | "launchTimedOut" | "possibleCrash";
  possibleCrash: boolean;
  source: "revox" | "manual";
}

export interface Activity {
  id: string;
  accountProfileId: string | null;
  gameId: string | null;
  kind: string;
  status: "success" | "error" | "info";
  message: string;
  errorCode: string | null;
  createdAt: string;
}

export interface ActivityInput {
  accountProfileId: string | null;
  gameId: string | null;
  kind: string;
  status: "success" | "error" | "info";
  message: string;
  errorCode: string | null;
}

export interface AppBootstrap {
  settings: AppSettings;
  accounts: AccountProfile[];
  games: Game[];
  accountGames: AccountGame[];
  sessions: Session[];
  activities: Activity[];
}

export type RobloxState = "ready" | "notFound" | "running" | "checkFailed";

export interface RobloxStatus {
  state: RobloxState;
  installationPath: string | null;
  detail: string | null;
}

/**
 * Anything the backend could not measure safely stays `null` and the UI shows
 * "not available" instead of a made-up number.
 */
export interface SystemSnapshot {
  osName: string | null;
  cpuName: string | null;
  cpuCores: number | null;
  cpuUsagePercent: number | null;
  memoryTotalBytes: number | null;
  memoryUsedBytes: number | null;
  gpuName: string | null;
  gpuUsagePercent: number | null;
}

export interface LaunchRequest {
  placeId: string;
  gameId: string | null;
  accountProfileId: string | null;
}

export interface LaunchReceipt {
  uri: string;
  activityId: string;
  acceptedAt: string;
}

export interface GameMetadata {
  placeId: string;
  universeId: string;
  name: string;
  description: string;
  iconUrl: string | null;
  playing: number | null;
  visits: number | null;
}
