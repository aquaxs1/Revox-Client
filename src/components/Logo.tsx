import { useId } from "react";

/**
 * The Revox mark: a solid "R" in the logo's cyan-to-blue gradient with a
 * diamond and a slab knocked out of it.
 *
 * The cut-outs are subpaths of the same path and rely on `evenodd`, so they
 * show whatever is behind the logo instead of a hardcoded background color.
 */
export function Logo({
  size = 28,
  variant = "mark",
  title,
}: {
  size?: number;
  variant?: "mark" | "full";
  title?: string;
}) {
  const gradientId = useId();
  const labelId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? "img" : "presentation"}
      aria-labelledby={title ? labelId : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title id={labelId}>{title}</title>}
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5BC8F5" />
          <stop offset="100%" stopColor="#1874FF" />
        </linearGradient>
      </defs>

      <path
        fill={`url(#${gradientId})`}
        fillRule="evenodd"
        d="
          M0 0
          H57
          C80 0 100 12 100 31
          C100 48 85 62 68 62
          L100 100
          H0
          Z
          M47 14 L69 32 L47 50 L25 32 Z
          M19 62 H40 L57 79 H17 Z
        "
      />

      {variant === "full" && (
        <text
          x="42"
          y="96"
          textAnchor="middle"
          fontFamily="'Segoe UI', system-ui, sans-serif"
          fontSize="17"
          fontWeight="700"
          letterSpacing="3"
          fill="var(--rv-bg, #0b0e13)"
        >
          evox
        </text>
      )}
    </svg>
  );
}
