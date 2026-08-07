import { describe, expect, it, vi } from "vitest";
import type { AppBootstrap, LaunchReceipt } from "../contracts/entities";
import { BackendError, createBackendPort, type InvokeFunction } from "./backend";

describe("Tauri backend boundary", () => {
  it("sends the launch command with a camelCase structured payload", async () => {
    const receipt: LaunchReceipt = {
      uri: "roblox://placeId=123456",
      activityId: "activity-1",
      acceptedAt: "2026-08-05T16:00:00Z",
    };
    const invoke = vi.fn<InvokeFunction>().mockResolvedValue(receipt);
    const backend = createBackendPort(invoke);

    await expect(
      backend.launchRoblox({
        placeId: "123456",
        accountProfileId: "account-1",
        performanceProfileId: "balanced",
      }),
    ).resolves.toEqual(receipt);
    expect(invoke).toHaveBeenCalledWith("launch_roblox", {
      input: {
        placeId: "123456",
        accountProfileId: "account-1",
        performanceProfileId: "balanced",
      },
    });
  });

  it("maps a structured Rust rejection to BackendError", async () => {
    const invoke = vi.fn<InvokeFunction>().mockRejectedValue({
      code: "ROBLOX_NOT_FOUND",
      message: "Roblox wurde nicht gefunden.",
    });
    const backend = createBackendPort(invoke);

    const error = await backend.getRobloxStatus().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(BackendError);
    expect(error).toMatchObject({
      code: "ROBLOX_NOT_FOUND",
      message: "Roblox wurde nicht gefunden.",
    });
  });

  it("propagates bootstrap failure without returning sample data", async () => {
    const invoke = vi
      .fn<InvokeFunction>()
      .mockRejectedValue(new Error("database unavailable"));
    const backend = createBackendPort(invoke);

    await expect(backend.getBootstrap()).rejects.toMatchObject({
      name: "BackendError",
      code: "UNEXPECTED",
      message: "database unavailable",
    });
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

const _bootstrapShape: AppBootstrap = {
  settings: { locale: "de" },
  accounts: [],
  games: [],
  sessions: [],
};
void _bootstrapShape;
