import { ImageIcon, Play, Plus, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import type { AccountProfile, Game } from "../contracts/entities";
import { dailyPlaytime, filterByAccount, splitDuration } from "../domain/stats";
import { useI18n } from "../i18n";
import { useAppStore } from "../state/AppStore";
import { AccountDialog } from "../components/AccountDialog";
import { Dialog } from "../components/Dialog";
import { Sparkline } from "../components/Sparkline";

export function ProfilePage({ onLaunch }: { onLaunch: (game: Game) => void }) {
  const { t } = useI18n();
  const { state, selectAccount, deleteAccount } = useAppStore();
  const [editing, setEditing] = useState<AccountProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AccountProfile | null>(null);

  const heroGame = state.games[0] ?? null;

  return (
    <div className="rv-page">
      {state.accounts.length === 0 && (
        <div className="rv-empty">
          <strong>{t("profile.noAccounts")}</strong>
          <p>{t("profile.noAccountsBody")}</p>
        </div>
      )}

      <div className="rv-profile-grid">
        {state.accounts.map((account, index) => {
          const active = account.id === state.settings.selectedAccountId;
          const sessions = filterByAccount(state.sessions, account.id);
          const buckets = dailyPlaytime(sessions, 14);
          const total = splitDuration(
            sessions.reduce((sum, session) => sum + (session.durationSeconds ?? 0), 0),
          );

          return (
            <article
              key={account.id}
              className="rv-profile-card"
              data-active={active}
            >
              <div className="rv-profile-head">
                <span
                  className="rv-avatar is-large"
                  style={{ ["--avatar-color" as string]: account.color }}
                >
                  {account.initials}
                </span>
                <span className="rv-profile-head-body">
                  <strong title={account.username}>{account.username}</strong>
                  <small>{account.label || `Profile ${index + 1}`}</small>
                </span>
                {active && <span className="rv-tag is-active">{t("profile.active")}</span>}
              </div>

              <figure className="rv-profile-chart" style={{ margin: 0 }}>
                <Sparkline
                  buckets={buckets}
                  emptyLabel={t("profile.chartEmpty")}
                  label={t("stats.chartTitle")}
                />
                <figcaption>
                  {t("profile.playtime")} · {t("stats.hours", { count: total.hours })}
                </figcaption>
              </figure>

              <p style={{ margin: 0, color: "var(--rv-text-muted)", fontSize: 12 }}>
                {t("profile.sessions", { count: sessions.length })}
              </p>

              <div className="rv-profile-foot">
                <button
                  className="rv-icon-button"
                  onClick={() => setEditing(account)}
                  aria-label={t("profile.editAccount")}
                  title={t("profile.editAccount")}
                >
                  <Settings2 size={15} />
                </button>
                <button
                  className="rv-icon-button"
                  onClick={() => setDeleting(account)}
                  aria-label={t("profile.delete")}
                  title={t("profile.delete")}
                >
                  <Trash2 size={15} />
                </button>
                <span className="rv-spacer" />

                {active ? (
                  <button
                    className="rv-button is-play"
                    onClick={() => heroGame && onLaunch(heroGame)}
                    disabled={!heroGame}
                  >
                    <Play size={15} fill="currentColor" />
                    {t("play.play")}
                  </button>
                ) : (
                  <button
                    className="rv-button"
                    onClick={() => void selectAccount(account.id)}
                  >
                    {t("profile.select")}
                  </button>
                )}
              </div>
            </article>
          );
        })}

        <button className="rv-add-card" onClick={() => setCreating(true)}>
          <Plus size={30} aria-hidden />
          {t("profile.addAccount")}
        </button>
      </div>

      {(creating || editing) && (
        <AccountDialog
          account={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <Dialog title={t("profile.delete")} onClose={() => setDeleting(null)}>
          <p style={{ margin: 0 }}>
            {t("profile.deleteQuestion", { name: deleting.username })}
          </p>
          <div className="rv-dialog-actions">
            <button className="rv-button is-ghost" onClick={() => setDeleting(null)}>
              {t("common.cancel")}
            </button>
            <button
              className="rv-button"
              onClick={() => {
                void deleteAccount(deleting.id, true);
                setDeleting(null);
              }}
            >
              {t("profile.deleteKeepStats")}
            </button>
            <button
              className="rv-button is-danger"
              onClick={() => {
                void deleteAccount(deleting.id, false);
                setDeleting(null);
              }}
            >
              {t("profile.deleteRemoveStats")}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
