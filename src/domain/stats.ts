import type { Game, Session } from "../contracts/entities";

/** One bar in the playtime chart. */
export interface DayBucket {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  minutes: number;
}

export interface GameTotal {
  gameId: string;
  seconds: number;
}

function completedSeconds(session: Session): number {
  return session.durationSeconds ?? 0;
}

export function filterByAccount(
  sessions: Session[],
  accountId: string | null,
): Session[] {
  if (!accountId) return sessions;
  return sessions.filter((session) => session.accountProfileId === accountId);
}

export function totalPlaytimeSeconds(sessions: Session[]): number {
  return sessions.reduce((sum, session) => sum + completedSeconds(session), 0);
}

export function distinctGamesPlayed(sessions: Session[]): number {
  const ids = new Set<string>();
  for (const session of sessions) {
    if (session.gameId) ids.add(session.gameId);
  }
  return ids.size;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Buckets playtime into the last `days` calendar days, ending today.
 *
 * Days without a session are kept as zero so the chart keeps an even x-axis
 * instead of silently compressing gaps.
 */
export function dailyPlaytime(
  sessions: Session[],
  days: number,
  today: Date = new Date(),
): DayBucket[] {
  const buckets = new Map<string, number>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    buckets.set(isoDate(day), 0);
  }

  for (const session of sessions) {
    const startedAt = new Date(session.startedAt);
    if (Number.isNaN(startedAt.getTime())) continue;
    const key = isoDate(startedAt);
    if (!buckets.has(key)) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + completedSeconds(session) / 60);
  }

  return [...buckets.entries()].map(([date, minutes]) => ({
    date,
    minutes: Math.round(minutes),
  }));
}

export function playtimeByGame(sessions: Session[]): GameTotal[] {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    if (!session.gameId) continue;
    totals.set(
      session.gameId,
      (totals.get(session.gameId) ?? 0) + completedSeconds(session),
    );
  }
  return [...totals.entries()]
    .map(([gameId, seconds]) => ({ gameId, seconds }))
    .sort((left, right) => right.seconds - left.seconds);
}

/** The game from the most recent session that still exists in the library. */
export function mostRecentGame(sessions: Session[], games: Game[]): Game | null {
  for (const session of sessions) {
    const game = games.find((entry) => entry.id === session.gameId);
    if (game) return game;
  }
  return null;
}

/** `3720` -> `{ hours: 1, minutes: 2 }`. Always rounds down to whole minutes. */
export function splitDuration(seconds: number): { hours: number; minutes: number } {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US").format(value);
}
