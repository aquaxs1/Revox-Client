import type { GameServer, GameStats, RobloxUser, UserPresence } from "../contracts/entities";

/**
 * Derived figures the Roblox website does not put in front of you.
 *
 * Each one returns `null` when its inputs are missing, so a derived value is
 * never computed from a guess.
 */

/** Share of positive votes, 0–100. `null` when nobody has voted. */
export function likeRatio(stats: Pick<GameStats, "upVotes" | "downVotes">): number | null {
  const up = stats.upVotes;
  const down = stats.downVotes;
  if (up === null || down === null) return null;
  const total = up + down;
  if (total <= 0) return null;
  return (up / total) * 100;
}

/**
 * Visits per player currently in game — a rough read on whether an experience
 * is coasting on history or actually busy right now.
 */
export function visitsPerActivePlayer(
  stats: Pick<GameStats, "visits" | "playing">,
): number | null {
  if (stats.visits === null || stats.playing === null || stats.playing <= 0) {
    return null;
  }
  return stats.visits / stats.playing;
}

export interface ServerSpread {
  total: number;
  full: number;
  medianFillPercent: number;
  playersOnline: number;
}

/** Summarizes a server list: how many exist, how many are full, median fill. */
export function serverSpread(servers: GameServer[]): ServerSpread | null {
  if (servers.length === 0) return null;

  const fills = servers
    .filter((server) => server.maxPlayers > 0)
    .map((server) => (server.playing / server.maxPlayers) * 100)
    .sort((left, right) => left - right);

  const middle = Math.floor(fills.length / 2);
  const median =
    fills.length === 0
      ? 0
      : fills.length % 2 === 1
        ? fills[middle]
        : (fills[middle - 1] + fills[middle]) / 2;

  return {
    total: servers.length,
    full: servers.filter(
      (server) => server.maxPlayers > 0 && server.playing >= server.maxPlayers,
    ).length,
    medianFillPercent: median,
    playersOnline: servers.reduce((sum, server) => sum + server.playing, 0),
  };
}

/**
 * How many followers an account has per friend.
 *
 * A high number is the signature of a creator or a well-known account; a low
 * one of an ordinary player.
 */
export function followersPerFriend(
  followers: number | null,
  friends: number | null,
): number | null {
  if (followers === null || friends === null || friends <= 0) return null;
  return followers / friends;
}

/**
 * Percentage a limited item's recent average price sits above (or below) its
 * original price.
 */
export function resaleMarkup(
  recentAveragePrice: number | null,
  originalPrice: number | null,
): number | null {
  if (
    recentAveragePrice === null ||
    originalPrice === null ||
    originalPrice <= 0
  ) {
    return null;
  }
  return ((recentAveragePrice - originalPrice) / originalPrice) * 100;
}

/** True when Roblox published enough of a presence for a join to work. */
export function isJoinable(presence: UserPresence | null): boolean {
  if (!presence) return false;
  const placeId = presence.rootPlaceId ?? presence.placeId;
  return (
    presence.state === "inGame" &&
    Boolean(placeId) &&
    Boolean(presence.gameInstanceId)
  );
}

/** The place a presence points at, preferring the root place of a universe. */
export function presencePlaceId(presence: UserPresence | null): string | null {
  return presence?.rootPlaceId ?? presence?.placeId ?? null;
}

export function displayNameOf(user: RobloxUser): string {
  return user.displayName.trim() || user.name;
}

export interface RankedServer extends GameServer {
  /** 0–100. `0` when Roblox reported no capacity. */
  fillPercent: number;
  joinable: boolean;
}

function withFill(server: GameServer): RankedServer {
  const fillPercent =
    server.maxPlayers > 0
      ? Math.min(100, (server.playing / server.maxPlayers) * 100)
      : 0;
  return {
    ...server,
    fillPercent,
    joinable: server.maxPlayers > 0 && server.playing < server.maxPlayers,
  };
}

/**
 * Orders servers the way someone picking one actually wants them: joinable
 * first, then lowest ping, then busiest.
 *
 * A server without a reported ping sorts behind every server that has one —
 * an unknown latency is not evidence of a good one.
 */
export function rankServers(servers: GameServer[]): RankedServer[] {
  return servers.map(withFill).sort((left, right) => {
    if (left.joinable !== right.joinable) return left.joinable ? -1 : 1;

    const leftPing = left.ping ?? Number.POSITIVE_INFINITY;
    const rightPing = right.ping ?? Number.POSITIVE_INFINITY;
    if (leftPing !== rightPing) return leftPing - rightPing;

    return right.playing - left.playing;
  });
}

/** The server the join button should default to, or `null` if all are full. */
export function bestServer(servers: GameServer[]): RankedServer | null {
  return rankServers(servers).find((server) => server.joinable) ?? null;
}
