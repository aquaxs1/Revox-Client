import { useI18n } from "../i18n";

export interface Stat {
  label: string;
  /** `null` renders as "not available" — never as a zero or a dash. */
  value: string | null;
  hint?: string;
}

/**
 * A grid of labelled facts.
 *
 * A value Revox could not obtain is shown as "not available" rather than as a
 * plausible-looking placeholder, so a missing number is never mistaken for a
 * measured one.
 */
export function StatGrid({ stats }: { stats: Stat[] }) {
  const { t } = useI18n();

  return (
    <div className="rv-facts">
      {stats.map((stat) => (
        <div className="rv-fact" key={stat.label}>
          <span>{stat.label}</span>
          <strong data-missing={stat.value === null}>
            {stat.value ?? t("common.notAvailable")}
          </strong>
          {stat.hint && <small className="rv-fact-hint">{stat.hint}</small>}
        </div>
      ))}
    </div>
  );
}
