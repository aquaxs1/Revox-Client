import { TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import type { WatchKind, WatchlistSample } from "../contracts/entities";
import { seriesFor, type MetricSeries } from "../domain/history";
import { formatCount } from "../domain/stats";
import { useI18n } from "../i18n";
import type { TranslationKey } from "../i18n/types";
import { useAppStore } from "../state/AppStore";
import { Sparkline } from "./Sparkline";

/**
 * The recorded history of one watched target.
 *
 * Only rendered for targets on the watchlist, because those are the only ones
 * Revox samples. A metric with a single reading shows its value but no change —
 * one point is not a trend.
 */
export function WatchHistory({
  kind,
  targetId,
}: {
  kind: WatchKind;
  targetId: string;
}) {
  const { t, locale } = useI18n();
  const { state, backend } = useAppStore();
  const [samples, setSamples] = useState<WatchlistSample[] | null>(null);

  const entry = state.watchlist.find(
    (candidate) => candidate.kind === kind && candidate.targetId === targetId,
  );
  const entryId = entry?.id;

  useEffect(() => {
    if (!entryId) {
      setSamples(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await backend.listWatchlistSamples(entryId);
        if (!cancelled) setSamples(loaded);
      } catch {
        if (!cancelled) setSamples([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backend, entryId]);

  if (!entryId) return null;

  const series = samples ? seriesFor(samples) : [];

  return (
    <section className="rv-settings-section">
      <div className="rv-section-head">
        <h2>{t("explore.history")}</h2>
      </div>

      {series.length === 0 ? (
        <p style={{ margin: 0, color: "var(--rv-text-muted)", fontSize: 12 }}>
          {t("explore.historyEmpty")}
        </p>
      ) : (
        <div className="rv-trend-grid">
          {series.map((entry) => (
            <TrendCard key={entry.metric} series={entry} locale={locale} />
          ))}
        </div>
      )}
    </section>
  );
}

function TrendCard({ series, locale }: { series: MetricSeries; locale: string }) {
  const { t } = useI18n();
  const label = t(`metric.${series.metric}` as TranslationKey);
  const rising = (series.change ?? 0) > 0;

  return (
    <article className="rv-trend">
      <span className="rv-fact-label">
        {label === `metric.${series.metric}` ? series.metric : label}
      </span>
      <strong>{formatCount(series.latest, locale)}</strong>

      {series.change === null ? (
        <small className="rv-fact-hint">{t("explore.since")}: —</small>
      ) : (
        <small className={rising ? "rv-trend-up" : "rv-trend-down"}>
          {rising ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {series.change > 0 ? "+" : ""}
          {formatCount(series.change, locale)}
          {series.changePercent !== null &&
            ` (${series.changePercent > 0 ? "+" : ""}${series.changePercent.toFixed(1)} %)`}
        </small>
      )}

      <div className="rv-trend-chart">
        <Sparkline
          buckets={series.points.map((point) => ({
            date: point.capturedAt,
            minutes: point.value,
          }))}
          emptyLabel=""
          height={48}
          label={label}
        />
      </div>
    </article>
  );
}
