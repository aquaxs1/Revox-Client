import { launchRoblox } from "./launcher";

describe("launchRoblox", () => {
  it("returns a safe preview result outside Tauri", async () => {
    await expect(launchRoblox("920587237")).resolves.toEqual({
      mode: "preview",
      url: "roblox://placeId=920587237",
    });
  });

  it("rejects an invalid Place-ID before invoking native code", async () => {
    await expect(launchRoblox("bad-id")).rejects.toThrow(
      "Ungültige Place-ID",
    );
  });
});
