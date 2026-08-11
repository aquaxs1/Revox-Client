import { isTauri } from "./backend";

/**
 * Window chrome controls for the custom title bar.
 *
 * The Tauri window API is imported lazily so the browser preview — which has
 * no window to control — never pulls it in.
 */
async function currentWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export async function minimizeWindow(): Promise<void> {
  if (!isTauri()) return;
  await (await currentWindow()).minimize();
}

export async function toggleMaximizeWindow(): Promise<void> {
  if (!isTauri()) return;
  await (await currentWindow()).toggleMaximize();
}

export async function closeWindow(): Promise<void> {
  if (!isTauri()) return;
  await (await currentWindow()).close();
}
