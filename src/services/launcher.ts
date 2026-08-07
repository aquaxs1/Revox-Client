import { buildLaunchUrl } from "../domain/roblox";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export interface LaunchResult {
  mode: "native" | "preview";
  url: string;
}

export async function launchRoblox(placeId: string): Promise<LaunchResult> {
  const url = buildLaunchUrl(placeId);

  if (!window.__TAURI_INTERNALS__) {
    return { mode: "preview", url };
  }

  const { invoke } = await import("@tauri-apps/api/core");
  const nativeUrl = await invoke<string>("launch_roblox", { placeId });
  return { mode: "native", url: nativeUrl };
}
