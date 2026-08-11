import { useId } from "react";
import type { DayBucket } from "../domain/stats";

/**
 * A minimal area/line chart for playtime buckets.
 *
 * Deliberately dependency-free: it draws one polyline plus a filled area, and
 * renders nothing but the empty message when every bucket is zero — an
 * all-zero chart would otherwise look like a measurement rather than "no data".
 */
export function Sparkline({
  buckets,
  emptyLabel,
  height = 100,
  label,
}: {
  buckets: DayBucket[];
  emptyLabel: string;
  height?: number;
  label: string;
}) {
  const gradientId = useId();
  const peak = Math.max(...buckets.map((bucket) => bucket.minutes), 0);

  if (buckets.length === 0 || peak === 0) {
    return (
      <p
        style={{
          margin: 0,
          display: "grid",
          placeItems: "center",
          height,
          color: "var(--rv-text-faint)",
          fontSize: 12,
          textAlign: "center",
        }}
      >
        {emptyLabel}
      </p>
    );
  }

  const width = 100;
  const step = buckets.length > 1 ? width / (buckets.length - 1) : width;
  const points = buckets.map((bucket, index) => {
    const x = index * step;
    const y = height - (bucket.minutes / peak) * (height - 8) - 4;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--rv-accent)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--rv-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <polygon
        fill={`url(#${gradientId})`}
        points={`0,${height} ${points.join(" ")} ${width},${height}`}
      />
      <polyline
        fill="none"
        stroke="var(--rv-accent-bright)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        points={points.join(" ")}
      />
    </svg>
  );
}
