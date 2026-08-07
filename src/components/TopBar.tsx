import { Bell, ChevronDown } from "lucide-react";
import { useAppStore } from "../state/AppStore";
import type { PageId } from "./AppShell";

const PAGE_TITLES: Record<PageId, string> = {
  dashboard: "Übersicht",
  library: "Spielebibliothek",
  accounts: "Lokale Profile",
  performance: "Performance",
  stats: "Spielstatistik",
  settings: "Einstellungen",
};

export function TopBar({ activePage }: { activePage: PageId }) {
  const { state } = useAppStore();
  const account = state.accounts.find(
    (entry) => entry.id === state.selectedAccountId,
  )!;

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">RIFT / {PAGE_TITLES[activePage]}</p>
      </div>
      <div className="topbar-actions">
        <div className="roblox-status">
          <span className="status-light" />
          <span>Roblox bereit</span>
        </div>
        <button className="icon-button" aria-label="Benachrichtigungen" title="Benachrichtigungen">
          <Bell size={18} />
          <span className="notification-dot" />
        </button>
        <button className="profile-menu" aria-label="Aktives lokales Profil">
          <span
            className="avatar avatar-small"
            style={{ "--avatar-color": account.color } as React.CSSProperties}
          >
            {account.initials}
          </span>
          <span className="profile-menu-copy">
            <strong>{account.username}</strong>
            <small>{account.label}</small>
          </span>
          <ChevronDown size={16} />
        </button>
      </div>
    </header>
  );
}
