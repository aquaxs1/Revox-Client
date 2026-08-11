import type { WatchlistSample } from "../contracts/entities";

export interface TrendPoint {
  capturedAt: string;
  value: number;
}

export interface MetricSeries {
  metric: string;
  points: TrendPoint[];
  latest: number;
  /** The reading before the latest one, or `null` on the first sample. */
  previous: number | null;
  /** Absolute change since the previous reading. */
  change: number | null;
  /** Percentage change, `null` when the previous reading was zero. */
  changePercent: number | null;
}

/**
 * Groups raw samples into one series per metric, newest last.
 *
 * A metric with a single sample has no `change`: one reading is a value, not a
 * trend, and showing "+100 %" against nothing would be an invention.
 */
export function seriesFor(samples: WatchlistSample[]): MetricSeries[] {
  const byMetric = new Map<string, TrendPoint[]>();

  for (const sample of samples) {
    const points = byMetric.get(sample.metric) ?? [];
    points.push({ capturedAt: sample.capturedAt, value: sample.value });
    byMetric.set(sample.metric, points);
  }

  return [...byMetric.entries()]
    .map(([metric, unsorted]) => {
      const points = [...unsorted].sort((left, right) =>
        left.capturedAt.localeCompare(right.capturedAt),
      );
      const latest = points[points.length - 1].value;
      const previous = points.length > 1 ? points[points.length - 2].value : null;
      const change = previous === null ? null : latest - previous;
      const changePercent =
        previous === null || previous === 0 ? null : (change! / previous) * 100;

      return { metric, points, latest, previous, change, changePercent };
    })
    .sort((left, right) => left.metric.localeCompare(right.metric));
}
