import { describe, expect, it } from "vitest";
import type { GameServer, UserPresence } from "../contracts/entities";
import {
  bestServer,
  followersPerFriend,
  isJoinable,
  likeRatio,
  presencePlaceId,
  rankServers,
  resaleMarkup,
  serverSpread,
  visitsPerActivePlayer,
} from "./roblox-stats";

function presence(overrides: Partial<UserPresence> = {}): UserPresence {
  return {
    userId: "261",
    state: "inGame",
    lastLocation: "Doors",
    placeId: "920587237",
    rootPlaceId: "920587237",
    gameInstanceId: "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0",
    universeId: "111",
    lastOnline: null,
    ...overrides,
  };
}

function server(playing: number, maxPlayers: number): GameServer {
  return { id: `s-${playing}-${maxPlayers}`, playing, maxPlayers, fps: null, ping: null };
}

describe("likeRatio", () => {
  it("returns the share of positive votes", () => {
    expect(likeRatio({ upVotes: 75, downVotes: 25 })).toBe(75);
  });

  it("is null when nobody voted or a count is missing", () => {
    expect(likeRatio({ upVotes: 0, downVotes: 0 })).toBeNull();
    expect(likeRatio({ upVotes: null, downVotes: 10 })).toBeNull();
    expect(likeRatio({ upVotes: 10, downVotes: null })).toBeNull();
  });
});

describe("visitsPerActivePlayer", () => {
  it("divides lifetime visits by current players", () => {
    expect(visitsPerActivePlayer({ visits: 1000, playing: 10 })).toBe(100);
  });

  it("never divides by zero", () => {
    expect(visitsPerActivePlayer({ visits: 1000, playing: 0 })).toBeNull();
    expect(visitsPerActivePlayer({ visits: null, playing: 10 })).toBeNull();
  });
});

describe("serverSpread", () => {
  it("counts full servers and reports the median fill", () => {
    const spread = serverSpread([
      server(10, 20),
      server(20, 20),
      server(5, 20),
    ]);

    expect(spread).toEqual({
      total: 3,
      full: 1,
      medianFillPercent: 50,
      playersOnline: 35,
    });
  });

  it("averages the two middle values for an even list", () => {
    const spread = serverSpread([server(0, 10), server(10, 10)]);
    expect(spread?.medianFillPercent).toBe(50);
  });

  it("is null for an empty list rather than zero", () => {
    expect(serverSpread([])).toBeNull();
  });
});

describe("followersPerFriend", () => {
  it("reports the ratio and guards against zero friends", () => {
    expect(followersPerFriend(500, 50)).toBe(10);
    expect(followersPerFriend(500, 0)).toBeNull();
    expect(followersPerFriend(null, 50)).toBeNull();
  });
});

describe("resaleMarkup", () => {
  it("reports the percentage over the original price", () => {
    expect(resaleMarkup(150, 100)).toBe(50);
    expect(resaleMarkup(50, 100)).toBe(-50);
  });

  it("is null when there is no original price to compare against", () => {
    expect(resaleMarkup(150, 0)).toBeNull();
    expect(resaleMarkup(150, null)).toBeNull();
    expect(resaleMarkup(null, 100)).toBeNull();
  });
});

describe("isJoinable", () => {
  it("needs an in-game presence with both a place and an instance", () => {
    expect(isJoinable(presence())).toBe(true);
  });

  it("refuses when Roblox withheld the server", () => {
    expect(isJoinable(presence({ gameInstanceId: null }))).toBe(false);
    expect(isJoinable(presence({ placeId: null, rootPlaceId: null }))).toBe(false);
    expect(isJoinable(presence({ state: "online" }))).toBe(false);
    expect(isJoinable(null)).toBe(false);
  });
});

describe("presencePlaceId", () => {
  it("prefers the root place so a teleport still resolves", () => {
    expect(presencePlaceId(presence({ rootPlaceId: "1", placeId: "2" }))).toBe("1");
    expect(presencePlaceId(presence({ rootPlaceId: null, placeId: "2" }))).toBe("2");
    expect(presencePlaceId(null)).toBeNull();
  });
});

describe("rankServers", () => {
  it("puts joinable servers first, then the lowest ping", () => {
    const ranked = rankServers([
      { id: "full", playing: 12, maxPlayers: 12, fps: null, ping: 10 },
      { id: "slow", playing: 4, maxPlayers: 12, fps: null, ping: 120 },
      { id: "fast", playing: 6, maxPlayers: 12, fps: null, ping: 30 },
    ]);

    expect(ranked.map((server) => server.id)).toEqual(["fast", "slow", "full"]);
  });

  it("sorts a server with no reported ping behind every server that has one", () => {
    const ranked = rankServers([
      { id: "unknown", playing: 5, maxPlayers: 12, fps: null, ping: null },
      { id: "known", playing: 5, maxPlayers: 12, fps: null, ping: 200 },
    ]);

    expect(ranked[0].id).toBe("known");
  });

  it("breaks a ping tie in favour of the busier server", () => {
    const ranked = rankServers([
      { id: "empty", playing: 1, maxPlayers: 12, fps: null, ping: 40 },
      { id: "busy", playing: 9, maxPlayers: 12, fps: null, ping: 40 },
    ]);

    expect(ranked[0].id).toBe("busy");
  });

  it("computes the fill percentage and guards a zero capacity", () => {
    const ranked = rankServers([
      { id: "half", playing: 6, maxPlayers: 12, fps: null, ping: 10 },
      { id: "broken", playing: 3, maxPlayers: 0, fps: null, ping: 10 },
    ]);

    expect(ranked.find((server) => server.id === "half")?.fillPercent).toBe(50);
    const broken = ranked.find((server) => server.id === "broken");
    expect(broken?.fillPercent).toBe(0);
    expect(broken?.joinable).toBe(false);
  });
});

describe("bestServer", () => {
  it("picks the fastest joinable server", () => {
    const best = bestServer([
      { id: "full", playing: 12, maxPlayers: 12, fps: null, ping: 5 },
      { id: "ok", playing: 6, maxPlayers: 12, fps: null, ping: 45 },
    ]);

    expect(best?.id).toBe("ok");
  });

  it("is null when every server is full", () => {
    expect(
      bestServer([{ id: "full", playing: 12, maxPlayers: 12, fps: null, ping: 5 }]),
    ).toBeNull();
    expect(bestServer([])).toBeNull();
  });
});
