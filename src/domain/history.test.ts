import { describe, expect, it } from "vitest";
import type { WatchlistSample } from "../contracts/entities";
import { seriesFor } from "./history";

function sample(metric: string, capturedAt: string, value: number): WatchlistSample {
  return { watchlistId: "w1", metric, capturedAt, value };
}

describe("seriesFor", () => {
  it("groups by metric and orders points oldest first", () => {
    const series = seriesFor([
      sample("followers", "2026-08-11T12:00:00Z", 140),
      sample("followers", "2026-08-10T12:00:00Z", 100),
      sample("friends", "2026-08-10T12:00:00Z", 20),
    ]);

    expect(series.map((entry) => entry.metric)).toEqual(["followers", "friends"]);
    expect(series[0].points.map((point) => point.value)).toEqual([100, 140]);
  });

  it("reports the change against the previous reading", () => {
    const [series] = seriesFor([
      sample("followers", "2026-08-10T12:00:00Z", 100),
      sample("followers", "2026-08-11T12:00:00Z", 140),
    ]);

    expect(series.latest).toBe(140);
    expect(series.previous).toBe(100);
    expect(series.change).toBe(40);
    expect(series.changePercent).toBe(40);
  });

  it("reports a fall as a negative change", () => {
    const [series] = seriesFor([
      sample("playing", "2026-08-10T12:00:00Z", 200),
      sample("playing", "2026-08-11T12:00:00Z", 150),
    ]);

    expect(series.change).toBe(-50);
    expect(series.changePercent).toBe(-25);
  });

  it("gives a single reading no change at all", () => {
    const [series] = seriesFor([sample("followers", "2026-08-11T12:00:00Z", 100)]);

    expect(series.latest).toBe(100);
    expect(series.previous).toBeNull();
    expect(series.change).toBeNull();
    expect(series.changePercent).toBeNull();
  });

  it("does not divide by zero when the previous reading was zero", () => {
    const [series] = seriesFor([
      sample("playing", "2026-08-10T12:00:00Z", 0),
      sample("playing", "2026-08-11T12:00:00Z", 30),
    ]);

    expect(series.change).toBe(30);
    expect(series.changePercent).toBeNull();
  });

  it("returns nothing for an empty history", () => {
    expect(seriesFor([])).toEqual([]);
  });
});
