import { ExternalLink, KeyRound, Plus, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useAppStore } from "../state/AppStore";

export function Accounts() {
  const { state, selectAccount } = useAppStore();

  return (
    <div className="page">
      <section className="page-heading split-heading">
        <div>
          <p className="eyebrow">LOKALE ORGANISATION</p>
          <h1>Deine Profile</h1>
          <p>Labels und Einstellungen pro Account, ohne Anmeldedaten zu speichern.</p>
        </div>
        <button className="secondary-button"><Plus size={18} /> Lokales Profil</button>
      </section>

      <section className="account-grid">
        {state.accounts.map((account) => {
          const selected = account.id === state.selectedAccountId;
          return (
            <article className={selected ? "account-card is-selected" : "account-card"} key={account.id}>
              <div className="account-card-top">
                <span className="avatar avatar-large" style={{ "--avatar-color": account.color } as React.CSSProperties}>{account.initials}</span>
                <span className="account-label" style={{ color: account.color }}>{account.label}</span>
                {selected && <UserRoundCheck size={20} />}
              </div>
              <div><h2>{account.username}</h2><p>Zuletzt verwendet: {account.lastUsed}</p></div>
              {selected ? (
                <div className="selected-profile-copy"><span className="status-light" /> Als lokales Profil aktiv</div>
              ) : (
                <button className="secondary-button full-width" onClick={() => selectAccount(account.id)} aria-label={`${account.username} auswählen`}>Auswählen</button>
              )}
            </article>
          );
        })}
      </section>

      <section className="account-handoff">
        <div className="handoff-icon"><KeyRound size={24} /></div>
        <div>
          <p className="eyebrow">ACCOUNT WECHSELN</p>
          <h2>Roblox übernimmt die Anmeldung</h2>
          <p>Nutze den offiziellen Account Switcher, Quick Login oder Passkeys. Rift erkennt und speichert keine Roblox-Sitzung.</p>
        </div>
        <button className="primary-button"><ExternalLink size={18} /> Roblox-Anmeldung öffnen</button>
      </section>

      <section className="safety-boundary-grid">
        <div className="safety-note"><ShieldCheck size={21} /><div><strong>Keine Passwörter</strong><p>Anmeldedaten bleiben ausschließlich bei Roblox.</p></div></div>
        <div className="safety-note"><ShieldCheck size={21} /><div><strong>Keine Session-Cookies</strong><p>`.ROBLOSECURITY` wird niemals gelesen oder gespeichert.</p></div></div>
        <div className="safety-note"><ShieldCheck size={21} /><div><strong>Nur lokale Labels</strong><p>Profilname, Farbe und Einstellungen bleiben auf deinem Gerät.</p></div></div>
      </section>
    </div>
  );
}
