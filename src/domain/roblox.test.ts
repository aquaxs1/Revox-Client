import { describe, expect, it } from "vitest";
import { buildLaunchUrl, parsePlaceId, validPlaceId } from "./roblox";

describe("parsePlaceId", () => {
  it("accepts a bare numeric Place ID", () => {
    expect(parsePlaceId("920587237")).toBe("920587237");
    expect(parsePlaceId("  920587237  ")).toBe("920587237");
  });

  it("extracts the Place ID from an official Roblox game link", () => {
    expect(parsePlaceId("https://www.roblox.com/games/920587237/Doors")).toBe(
      "920587237",
    );
    expect(parsePlaceId("https://roblox.com/games/123")).toBe("123");
  });

  it("rejects look-alike hosts, plain HTTP and non-game paths", () => {
    expect(parsePlaceId("https://roblox.com.evil.example/games/123")).toBeNull();
    expect(parsePlaceId("http://www.roblox.com/games/123")).toBeNull();
    expect(parsePlaceId("https://www.roblox.com/users/123/profile")).toBeNull();
    expect(parsePlaceId("javascript:alert(1)")).toBeNull();
  });

  it("rejects anything that is not purely digits", () => {
    expect(parsePlaceId("")).toBeNull();
    expect(parsePlaceId("123abc")).toBeNull();
    expect(parsePlaceId("123 & calc.exe")).toBeNull();
    expect(parsePlaceId("123456789012345678901")).toBeNull();
  });
});

describe("buildLaunchUrl", () => {
  it("builds the official protocol URL", () => {
    expect(buildLaunchUrl("920587237")).toBe("roblox://placeId=920587237");
  });

  it("refuses to build a URL from an invalid Place ID", () => {
    expect(() => buildLaunchUrl("123 & calc.exe")).toThrow();
    expect(validPlaceId("123 & calc.exe")).toBe(false);
  });
});
