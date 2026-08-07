import { buildLaunchUrl, parsePlaceId } from "./roblox";

describe("parsePlaceId", () => {
  it("accepts a numeric Place-ID", () => {
    expect(parsePlaceId("920587237")).toBe("920587237");
  });

  it("accepts the maximum 20 ASCII digits", () => {
    expect(parsePlaceId("12345678901234567890")).toBe("12345678901234567890");
  });

  it("extracts the Place-ID from an official game URL", () => {
    expect(parsePlaceId("https://www.roblox.com/games/920587237/Adopt-Me")).toBe(
      "920587237",
    );
  });

  it.each([
    "javascript:alert(1)",
    "https://not-roblox.com/games/920587237",
    "https://roblox.com/users/920587237/profile",
    "123456789012345678901",
    "+123456",
    "-123456",
    " 123456",
    "123456 ",
    "١٢٣٤٥٦",
    "12abc",
    "",
  ])("rejects unsafe or unsupported input: %s", (input) => {
    expect(parsePlaceId(input)).toBeNull();
  });
});

describe("buildLaunchUrl", () => {
  it("builds the official protocol URL", () => {
    expect(buildLaunchUrl("920587237")).toBe("roblox://placeId=920587237");
  });

  it("rejects a non-numeric Place-ID", () => {
    expect(() => buildLaunchUrl("bad-id")).toThrow("Ungültige Place-ID");
  });
});
