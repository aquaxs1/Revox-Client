import { useMemo, useState } from "react";
import {
  dailyPlaytime,
  distinctGamesPlayed,
  filterByAccount,
  formatCount,
  playtimeByGame,
  splitDuration,
  totalPlaytimeSeconds,
} from "../domain/stats";
import { useI18n } from "../i18n";
import { useAppStore } from "../state/AppStore";
import { Sparkline } from "../components/Sparkline";

/** Tab accent colors, matching the stats mockup. */
const ALL_TAB_COLOR = "#F2557A";
const PROFILE_TAB_COLOR = "#F58A24";

export function StatsPage() {
  const { t, locale } = useI18n();
  const { state } = useAppStore();
  const [scope, setScope] = useState<"all" | "account">("all");

  const activeAccount = state.accounts.find(
    (account) => account.id === state.settings.selectedAccountId,
  );
  const scoped = scope === "account" && activeAccount ? activeAccount.id : null;

  const sessions = useMemo(
    () => filterByAccount(state.sessions, scoped),
    [scoped, state.sessions],
  );

  const total = splitDuration(totalPlaytimeSeconds(sessions));
  const buckets = dailyPlaytime(sessions, 14);
  const topGames = playtimeByGame(sessions).slice(0, 5);
  const peakSeconds = topGames[0]?.seconds ?? 0;

  return (
    <div className="rv-page">
      <div className="rv-tabs">
        <button
          className="rv-tab"
          style={{ ["--tab-color" as string]: ALL_TAB_COLOR }}
          aria-pressed={scope === "all"}
          onClick={() => setScope("all")}
        >
          {t("stats.all")}
        </button>
        {activeAccount && (
          <button
            className="rv-tab"
            style={{ ["--tab-color" as string]: PROFILE_TAB_COLOR }}
            aria-pressed={scope === "account"}
            onClick={() => setScope("account")}
          >
            {activeAccount.username}
          </button>
        )}
      </div>

      <section className="rv-stat-tiles">
        <article className="rv-stat-tile">
          <p className="rv-stat-value">
            {`${total.hours}h`}
            <small>{t("stats.playtime")}</small>
          </p>
          <p>{t("stats.minutes", { count: total.minutes })}</p>
        </article>

        <article className="rv-stat-tile">
          <p className="rv-stat-value">{distinctGamesPlayed(sessions)}</p>
          <p>{t("stats.differentGames")}</p>
        </article>

        <article className="rv-stat-tile">
          <p className="rv-stat-value">
            {formatCount(state.settings.robuxSpent, locale)}
          </p>
          <p>{t("stats.robuxSpent")}</p>
          <p className="rv-hint">{t("stats.robuxHint")}</p>
        </article>
      </section>

      <section className="rv-chart-panel">
        <div className="rv-section-head">
          <h2>{t("stats.chartTitle")}</h2>
          <span style={{ color: "var(--rv-text-faint)", fontSize: 11 }}>
            {t("stats.chartMinutes")}
          </span>
        </div>

        {sessions.length === 0 ? (
          <div className="rv-empty">
            <strong>{t("stats.noData")}</strong>
            <p>{t("stats.noDataBody")}</p>
          </div>
        ) : (
          <div className="rv-chart">
            <Sparkline
              buckets={buckets}
              emptyLabel={t("stats.noData")}
              height={200}
              label={t("stats.chartTitle")}
            />
          </div>
        )}
      </section>

      {topGames.length > 0 && (
        <section className="rv-chart-panel">
          <div className="rv-section-head">
            <h2>{t("stats.topGames")}</h2>
          </div>
          <div className="rv-top-games">
            {topGames.map((entry) => {
              const game = state.games.find((candidate) => candidate.id === entry.gameId);
              const { hours, minutes } = splitDuration(entry.seconds);
              return (
                <div className="rv-top-game" key={entry.gameId}>
                  <span>{game?.name ?? entry.gameId}</span>
                  <b>
                    {hours > 0
                      ? t("stats.hours", { count: hours })
                      : t("stats.minutes", { count: minutes })}
                  </b>
                  <span className="rv-meter">
                    <i
                      style={{
                        width: `${peakSeconds > 0 ? (entry.seconds / peakSeconds) * 100 : 0}%`,
                      }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
