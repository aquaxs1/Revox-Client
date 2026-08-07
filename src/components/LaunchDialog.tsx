import { ExternalLink, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import type { AccountProfile, Game } from "../state/types";

interface LaunchDialogProps {
  game: Game;
  account: AccountProfile;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function LaunchDialog({
  game,
  account,
  onClose,
  onConfirm,
}: LaunchDialogProps) {
  const [launching, setLaunching] = useState(false);

  async function confirm() {
    setLaunching(true);
    try {
      await onConfirm();
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section
        className="launch-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="dialog-close" onClick={onClose} aria-label="Dialog schließen">
          <X size={19} />
        </button>
        <div className="dialog-game-row">
          <div
            className="cover-art dialog-cover"
            style={{
              backgroundImage: `url(${game.thumbnail})`,
              backgroundPosition: game.coverPosition,
            }}
          />
          <div>
            <p className="eyebrow">OFFIZIELLER START</p>
            <h2 id="launch-title">Offiziell mit Roblox öffnen?</h2>
            <p>{game.title} · Place-ID {game.placeId}</p>
          </div>
        </div>
        <div className="launch-summary">
          <span
            className="avatar avatar-small"
            style={{ "--avatar-color": account.color } as React.CSSProperties}
          >
            {account.initials}
          </span>
          <div>
            <small>Lokales Profil</small>
            <strong>{account.username}</strong>
          </div>
          <div>
            <small>Übergabe</small>
            <strong>Roblox-Protokoll</strong>
          </div>
        </div>
        <div className="safety-note compact">
          <ShieldCheck size={20} />
          <div>
            <strong>Keine Passwörter oder Cookies</strong>
            <p>Rift übergibt nur die Place-ID an den offiziellen Roblox-Client.</p>
          </div>
        </div>
        <div className="dialog-actions">
          <button className="secondary-button" onClick={onClose}>Abbrechen</button>
          <button className="primary-button" onClick={confirm} disabled={launching}>
            <ExternalLink size={18} />
            {launching ? "Wird geöffnet …" : "Mit Roblox öffnen"}
          </button>
        </div>
      </section>
    </div>
  );
}
