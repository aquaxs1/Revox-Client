import type {
  AccountGame,
  AccountProfile,
  Activity,
  AppSettings,
  Game,
  RobloxStatus,
  Session,
  SystemSnapshot,
} from "../contracts/entities";

export type LoadStatus = "loading" | "ready" | "error";

export interface AppState {
  status: LoadStatus;
  errorCode: string | null;
  settings: AppSettings;
  accounts: AccountProfile[];
  games: Game[];
  accountGames: AccountGame[];
  sessions: Session[];
  activities: Activity[];
  robloxStatus: RobloxStatus | null;
  system: SystemSnapshot | null;
}
