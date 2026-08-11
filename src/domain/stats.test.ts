import { describe, expect, it } from "vitest";
import type { Game, Session } from "../contracts/entities";
import {
  dailyPlaytime,
  distinctGamesPlayed,
  filterByAccount,
  mostRecentGame,
  playtimeByGame,
  splitDuration,
  totalPlaytimeSeconds,
} from "./stats";

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    accountProfileId: "account-1",
    gameId: "game-1",
    placeId: "123",
    startedAt: "2026-08-10T12:00:00.000Z",
    endedAt: "2026-08-10T13:00:00.000Z",
    durationSeconds: 3600,
    result: "completed",
    possibleCrash: false,
    source: "revox",
    gameInstanceId: null,
    ...overrides,
  };
}

function game(id: string): Game {
  return {
    id,
    placeId: "123",
    name: id,
    description: "",
    imageUrl: null,
    tags: [],
    universeId: null,
    playing: null,
    visits: null,
    lastLaunchedAt: null,
  };
}

describe("totalPlaytimeSeconds", () => {
  it("adds up finished sessions and ignores open ones", () => {
    const sessions = [
      session(),
      session({ id: "session-2", durationSeconds: 1800 }),
      session({ id: "session-3", durationSeconds: null }),
    ];

    expect(totalPlaytimeSeconds(sessions)).toBe(5400);
  });

  it("is zero for an empty history rather than NaN", () => {
    expect(totalPlaytimeSeconds([])).toBe(0);
  });
});

describe("distinctGamesPlayed", () => {
  it("counts each game once and skips sessions without a game", () => {
    const sessions = [
      session(),
      session({ id: "s2" }),
      session({ id: "s3", gameId: "game-2" }),
      session({ id: "s4", gameId: null }),
    ];

    expect(distinctGamesPlayed(sessions)).toBe(2);
  });
});

describe("filterByAccount", () => {
  it("returns everything when no account is selected", () => {
    const sessions = [session(), session({ id: "s2", accountProfileId: "other" })];
    expect(filterByAccount(sessions, null)).toHaveLength(2);
  });

  it("narrows to one profile when one is selected", () => {
    const sessions = [session(), session({ id: "s2", accountProfileId: "other" })];
    expect(filterByAccount(sessions, "other")).toHaveLength(1);
  });
});

describe("dailyPlaytime", () => {
  const today = new Date("2026-08-11T18:00:00.000Z");

  it("keeps empty days as zero so the axis stays even", () => {
    const buckets = dailyPlaytime([session()], 3, today);

    expect(buckets.map((bucket) => bucket.date)).toEqual([
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
    ]);
    expect(buckets.map((bucket) => bucket.minutes)).toEqual([0, 60, 0]);
  });

  it("ignores sessions outside the window and unparsable dates", () => {
    const buckets = dailyPlaytime(
      [
        session({ startedAt: "2026-01-01T10:00:00.000Z" }),
        session({ id: "s2", startedAt: "not a date" }),
      ],
      3,
      today,
    );

    expect(buckets.every((bucket) => bucket.minutes === 0)).toBe(true);
  });
});

describe("playtimeByGame", () => {
  it("totals per game and sorts by time descending", () => {
    const totals = playtimeByGame([
      session(),
      session({ id: "s2", gameId: "game-2", durationSeconds: 7200 }),
      session({ id: "s3", gameId: "game-2", durationSeconds: 600 }),
    ]);

    expect(totals).toEqual([
      { gameId: "game-2", seconds: 7800 },
      { gameId: "game-1", seconds: 3600 },
    ]);
  });
});

describe("mostRecentGame", () => {
  it("skips sessions whose game was removed from the library", () => {
    const sessions = [session({ gameId: "deleted" }), session({ id: "s2" })];

    expect(mostRecentGame(sessions, [game("game-1")])?.id).toBe("game-1");
    expect(mostRecentGame(sessions, [])).toBeNull();
  });
});

describe("splitDuration", () => {
  it("splits seconds into whole hours and minutes", () => {
    expect(splitDuration(3720)).toEqual({ hours: 1, minutes: 2 });
    expect(splitDuration(59)).toEqual({ hours: 0, minutes: 0 });
    expect(splitDuration(-10)).toEqual({ hours: 0, minutes: 0 });
  });
});
