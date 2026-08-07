export type ThemeMode = "dark" | "light";
export type Density = "compact" | "comfortable";

export interface Game {
  id: string;
  placeId: string;
  title: string;
  genre: string;
  description: string;
  thumbnail: string;
  coverPosition: string;
  accent: string;
  favorite: boolean;
  lastPlayed: string | null;
  playMinutes: number;
}

export interface AccountProfile {
  id: string;
  username: string;
  label: string;
  initials: string;
  color: string;
  lastUsed: string;
  status: "active" | "local";
}

export interface PerformanceProfile {
  id: "performance" | "balanced" | "quality";
  name: string;
  description: string;
  fpsTarget: string;
  graphics: string;
  backgroundApps: string;
  recommended?: boolean;
}

export interface Session {
  id: string;
  gameId: string;
  date: string;
  durationMinutes: number;
  avgFps: number;
  ping: number;
}

export interface Activity {
  id: string;
  gameId: string;
  timestamp: string;
  success: boolean;
}

export interface AppearanceSettings {
  theme: ThemeMode;
  accent: "cyan" | "coral" | "lime";
  font: "system" | "condensed" | "rounded";
  density: Density;
}

export interface AppState {
  games: Game[];
  accounts: AccountProfile[];
  profiles: PerformanceProfile[];
  sessions: Session[];
  activity: Activity[];
  selectedGameId: string;
  selectedAccountId: string;
  performanceProfileId: PerformanceProfile["id"];
  appearance: AppearanceSettings;
}
