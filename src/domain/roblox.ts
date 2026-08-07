const PLACE_ID_PATTERN = /^\d{1,20}$/;
const ALLOWED_HOSTS = new Set(["roblox.com", "www.roblox.com"]);

export function parsePlaceId(input: string): string | null {
  if (input !== input.trim()) return null;
  const value = input;

  if (PLACE_ID_PATTERN.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
      return null;
    }

    const match = url.pathname.match(/^\/games\/(\d{1,20})(?:\/|$)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function buildLaunchUrl(placeId: string): string {
  if (!PLACE_ID_PATTERN.test(placeId)) {
    throw new Error("Ungültige Place-ID");
  }

  return `roblox://placeId=${placeId}`;
}
