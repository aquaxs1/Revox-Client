import { invoke } from "@tauri-apps/api/core";
import type { BackendPort } from "../contracts/commands";
import type {
  AppBootstrap,
  AppSettings,
  LaunchReceipt,
  RobloxStatus,
} from "../contracts/entities";

export type InvokeFunction = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

export class BackendError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

function toBackendError(reason: unknown) {
  if (
    typeof reason === "object" &&
    reason !== null &&
    "code" in reason &&
    "message" in reason &&
    typeof reason.code === "string" &&
    typeof reason.message === "string"
  ) {
    return new BackendError(reason.code, reason.message);
  }

  return new BackendError(
    "UNEXPECTED",
    reason instanceof Error ? reason.message : "Unexpected backend error",
  );
}

async function invokeBackend<T>(
  invokeFunction: InvokeFunction,
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return (await invokeFunction(command, args)) as T;
  } catch (reason) {
    throw toBackendError(reason);
  }
}

export function createBackendPort(invokeFunction: InvokeFunction): BackendPort {
  return {
    getBootstrap: () =>
      invokeBackend<AppBootstrap>(invokeFunction, "get_bootstrap"),
    saveSettings: (input) =>
      invokeBackend<AppSettings>(invokeFunction, "save_settings", { input }),
    getRobloxStatus: () =>
      invokeBackend<RobloxStatus>(invokeFunction, "get_roblox_status"),
    launchRoblox: (input) =>
      invokeBackend<LaunchReceipt>(invokeFunction, "launch_roblox", { input }),
  };
}

export const backend = createBackendPort(invoke as InvokeFunction);
