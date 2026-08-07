import type {
  AppBootstrap,
  AppSettings,
  LaunchReceipt,
  LaunchRequest,
  RobloxStatus,
  SettingsInput,
} from "./entities";

export interface BackendPort {
  getBootstrap(): Promise<AppBootstrap>;
  saveSettings(input: SettingsInput): Promise<AppSettings>;
  getRobloxStatus(): Promise<RobloxStatus>;
  launchRoblox(input: LaunchRequest): Promise<LaunchReceipt>;
}
