const PLACE_ID_PATTERN = /^\d{1,20}$/;
const ALLOWED_HOSTS = new Set(["roblox.com", "www.roblox.com"]);

export function validPlaceId(value: string): boolean {
  return PLACE_ID_PATTERN.test(value);
}

/**
 * Accepts either a bare Place ID or an official Roblox game URL and returns
 * the Place ID.
 *
 * Only HTTPS links on roblox.com are accepted; anything else returns `null` so
 * a look-alike host can never reach the launch path.
 */
export function parsePlaceId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

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
    throw new Error("Invalid Place ID");
  }
  return `roblox://placeId=${placeId}`;
}
