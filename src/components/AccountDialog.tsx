import { useState, type FormEvent } from "react";
import type { AccountProfile } from "../contracts/entities";
import { useI18n } from "../i18n";
import { toBackendError } from "../services/backend";
import { useAppStore } from "../state/AppStore";
import { Dialog } from "./Dialog";

export const PROFILE_COLORS = [
  "#2E9BF0",
  "#35C759",
  "#F5A524",
  "#F2557A",
  "#A46BF5",
  "#5BC8F5",
];

/** Create or edit a local profile. Never asks for a Roblox password. */
export function AccountDialog({
  account,
  onClose,
}: {
  account: AccountProfile | null;
  onClose: () => void;
}) {
  const { t, translateError } = useI18n();
  const { saveAccount } = useAppStore();
  const [username, setUsername] = useState(account?.username ?? "");
  const [label, setLabel] = useState(account?.label ?? "");
  const [note, setNote] = useState(account?.note ?? "");
  const [color, setColor] = useState(account?.color ?? PROFILE_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveAccount({
        id: account?.id ?? null,
        username,
        label,
        color,
        note,
        avatarUrl: account?.avatarUrl ?? null,
      });
      onClose();
    } catch (reason) {
      const failure = toBackendError(reason);
      setError(translateError(failure.code, failure.message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      title={account ? t("profile.editAccount") : t("profile.newAccount")}
      onClose={onClose}
    >
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--rv-gap-sm)" }}>
        <div className="rv-field">
          <label htmlFor="rv-username">{t("profile.username")}</label>
          <input
            id="rv-username"
            className="rv-input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            maxLength={40}
            autoFocus
            required
          />
          <small>{t("profile.usernameHint")}</small>
        </div>

        <div className="rv-field">
          <label htmlFor="rv-label">{t("profile.label")}</label>
          <input
            id="rv-label"
            className="rv-input"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={40}
          />
        </div>

        <div className="rv-field">
          <label htmlFor="rv-note">{t("profile.note")}</label>
          <input
            id="rv-note"
            className="rv-input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={120}
          />
        </div>

        <div className="rv-field">
          <span id="rv-color-label">{t("profile.color")}</span>
          <div className="rv-swatches" role="group" aria-labelledby="rv-color-label">
            {PROFILE_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                className="rv-swatch"
                style={{ ["--swatch-color" as string]: option }}
                aria-pressed={color === option}
                aria-label={option}
                onClick={() => setColor(option)}
              />
            ))}
          </div>
        </div>

        {error && <p className="rv-error-text">{error}</p>}

        <div className="rv-dialog-actions">
          <button type="button" className="rv-button is-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="rv-button is-primary" disabled={saving}>
            {t("common.save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
